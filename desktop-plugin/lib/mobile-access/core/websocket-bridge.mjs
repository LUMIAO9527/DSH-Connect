// Selected WebSocket protocol relay adapted from dsh-mobile 0.6.18.
// Apache-2.0; see ../NOTICE and ../LICENSE. Maintained by DSH Connect.
import WebSocket, { WebSocketServer } from 'ws';
import { HttpError } from './http-security.mjs';

function payloadBytes(data) {
	if (Array.isArray(data)) return data.reduce((bytes, part) => bytes + part.byteLength, 0);
	return data.byteLength;
}
function forwardableClose(code) {
	return code >= 1e3 && code <= 1014 && code !== 1004 && code !== 1005 && code !== 1006 || code >= 3e3 && code <= 4999;
}
/**
* Bridge an authorized HTTP upgrade, negotiating compression only with the client.
* Errors after acceptance close both legs. Socket destruction by the gateway also
* releases the ws wrappers, pending compression, and handshake/close timers.
* @param request - validated browser upgrade request.
* @param client - gateway-owned client socket, paused during authorization.
* @param upstream - gateway-owned loopback socket, connecting or connected.
* @param head - bytes the HTTP parser read after the client's upgrade headers.
* @param target - validated upstream URL, including the original query.
* @param upstreamCookie - gateway's signed upstream cookie; browser cookies are discarded.
* @param options - resolved message, queue, and compression limits.
* @param handshakeTimeoutMs - maximum handshake and close-handshake duration.
* @returns fulfillment after both HTTP upgrades are accepted, or rejection before acceptance.
*/
export function bridgeCompressedWebSocket(request, client, upstream, head, target, upstreamCookie, options, handshakeTimeoutMs) {
	return new Promise((resolve, reject) => {
		let incoming;
		let outgoing;
		let server;
		let accepted = false;
		let stopped = false;
		let closing = false;
		let closeTimer;
		let heartbeatTimer;
		const pendingReleases = new Set();
		let lastClientActivity = Date.now();
		const handshakeTimer = setTimeout(() => {
			stop(/* @__PURE__ */ new Error("WebSocket bridge handshake timed out"));
		}, handshakeTimeoutMs);
		handshakeTimer.unref();
		const stop = (error) => {
			if (stopped) return;
			stopped = true;
			clearTimeout(handshakeTimer);
			clearTimeout(closeTimer);
			clearInterval(heartbeatTimer);
			for (const release of pendingReleases) release();
			pendingReleases.clear();
			if (!accepted) reject(error);
			incoming?.terminate();
			outgoing?.terminate();
			client.destroy();
			upstream.destroy();
			server?.close();
		};
		const finish = () => {
			if (incoming?.readyState === WebSocket.CLOSED && outgoing?.readyState === WebSocket.CLOSED) stop(/* @__PURE__ */ new Error("WebSocket bridge closed"));
		};
		const beginClose = (code, reason) => {
			if (!accepted) {
				stop(new Error(reason));
				return;
			}
			if (stopped || closing) return;
			closing = true;
			options.onDiagnostic?.({ code: 'closing', closeCode: code });
			incoming?.resume();
			outgoing?.resume();
			for (const socket of [incoming, outgoing]) if (socket?.readyState === WebSocket.OPEN) socket.close(code, reason);
			closeTimer = setTimeout(() => {
				stop(/* @__PURE__ */ new Error("WebSocket bridge close timed out"));
			}, handshakeTimeoutMs);
			closeTimer.unref();
		};
		const socketError = (error) => {
			stop(error);
		};
		const socketClosed = () => {
			if (!accepted) stop(/* @__PURE__ */ new Error("WebSocket socket closed before acceptance"));
		};
		client.on("error", socketError);
		upstream.on("error", socketError);
		client.once("close", socketClosed);
		upstream.once("close", socketClosed);
		const wsError = (error) => {
			if (!accepted) {
				stop(error);
				return;
			}
			beginClose(error.code === "WS_ERR_UNSUPPORTED_MESSAGE_LENGTH" ? 1009 : 1011, error.code === "WS_ERR_UNSUPPORTED_MESSAGE_LENGTH" ? "Message too large" : "WebSocket bridge failed");
		};
		const attachRelay = (source, destination) => {
			let queuedBytes = 0;
			const send = (bytes, operation) => {
				if (stopped || closing) return;
				if (destination.readyState !== WebSocket.OPEN) {
					beginClose(1011, "WebSocket peer unavailable");
					return;
				}
				const queued = bytes + 14;
				if (queued > options.maxQueuedBytes - queuedBytes) {
					options.onDiagnostic?.({ code: 'direction_queue_limit', queuedBytes });
					beginClose(1009, "WebSocket queue limit");
					return;
				}
				const releaseBudget = options.reserveQueuedBytes?.(queued);
				if (options.reserveQueuedBytes && releaseBudget === undefined) {
					options.onDiagnostic?.({ code: 'shared_queue_limit', queuedBytes });
					beginClose(1009, "WebSocket shared queue limit");
					return;
				}
				queuedBytes += queued;
				let released = false;
				const release = () => {
					if (released) return;
					released = true;
					queuedBytes -= queued;
					releaseBudget?.();
					pendingReleases.delete(release);
				};
				pendingReleases.add(release);
				const complete = (error) => {
					release();
					if (error != null) {
						wsError(error);
						return;
					}
				};
				try {
					operation(complete);
				} catch (error) {
					complete(error instanceof Error ? error : /* @__PURE__ */ new Error("WebSocket forwarding failed"));
				}
			};
			source.on("message", (data, binary) => {
				const bytes = payloadBytes(data);
				if (bytes > options.maxMessageBytes) {
					options.onDiagnostic?.({ code: 'message_limit', queuedBytes: bytes });
					beginClose(1009, "Message too large");
					return;
				}
				send(bytes, (callback) => {
					destination.send(data, {
						binary,
						compress: destination === incoming
					}, callback);
				});
			});
			// This proxy terminates two WebSocket legs. Answer control frames on
			// their own leg; the Host's loopback heartbeat must not wait behind a
			// large frame crossing the mobile link. Data remains byte/type exact
			// and the finite queue cap owns overload; pausing the reader here would
			// also stop it from reading the healthy Host's control frames.
			source.on("close", (code, reason) => {
				if (stopped) return;
				options.onDiagnostic?.({ code: source === incoming ? 'client_closed' : 'host_closed', closeCode: code });
				if (code === 1006 || !forwardableClose(code) && code !== 1005) {
					stop(/* @__PURE__ */ new Error("WebSocket peer closed without a valid close frame"));
					return;
				}
				closing = true;
				destination.resume();
				if (destination.readyState === WebSocket.OPEN) {
					if (code === 1005) destination.close();
					else destination.close(code, reason);
				}
				closeTimer ??= setTimeout(() => {
					stop(/* @__PURE__ */ new Error("WebSocket bridge close timed out"));
				}, handshakeTimeoutMs);
				closeTimer.unref();
				finish();
			});
		};
		try {
			if (client.destroyed || upstream.destroyed) throw new Error("WebSocket socket is already closed");
			const protocolHeader = request.headers["sec-websocket-protocol"];
			const protocols = typeof protocolHeader === "string" ? protocolHeader.split(",").map((protocol) => protocol.trim()) : [];
			const url = new URL(target);
			url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
			outgoing = new WebSocket(url, protocols, {
				createConnection: () => upstream,
				handshakeTimeout: handshakeTimeoutMs,
				perMessageDeflate: false,
				autoPong: true,
				followRedirects: false,
				maxPayload: options.maxMessageBytes,
				headers: {
					...options.headers,
					host: target.host,
					origin: target.origin,
					"sec-fetch-site": "same-origin",
					...upstreamCookie === void 0 ? {} : { cookie: upstreamCookie }
				}
			});
			outgoing.on("error", wsError);
			outgoing.once('unexpected-response', (_request, response) => {
				response.resume();
				stop(new HttpError(502, response.statusCode === 401 ? 'upstream_authentication_failed' : 'upstream_upgrade_rejected'));
			});
			outgoing.once("close", () => {
				if (!accepted) stop(/* @__PURE__ */ new Error("Upstream WebSocket closed before acceptance"));
				else finish();
			});
			outgoing.once("open", () => {
				if (stopped || client.destroyed) {
					stop(/* @__PURE__ */ new Error("Client closed before WebSocket acceptance"));
					return;
				}
				upstream.setTimeout(0);
				server = new WebSocketServer({
					noServer: true,
					clientTracking: false,
					autoPong: true,
					maxPayload: options.maxMessageBytes,
					handleProtocols: () => outgoing?.protocol || false,
					perMessageDeflate: {
						clientNoContextTakeover: true,
						serverNoContextTakeover: true,
						threshold: options.thresholdBytes,
						concurrencyLimit: options.concurrencyLimit,
						zlibDeflateOptions: { level: options.level }
					}
				});
				server.on("error", wsError);
				try {
					server.handleUpgrade(request, client, head, (socket) => {
						incoming = socket;
						lastClientActivity = Date.now();
						incoming.on("error", wsError);
						incoming.once("close", finish);
						const clientAlive = () => { lastClientActivity = Date.now(); };
						incoming.on("message", clientAlive);
						incoming.on("ping", clientAlive);
						incoming.on("pong", clientAlive);
						attachRelay(incoming, outgoing);
						attachRelay(outgoing, incoming);
						accepted = true;
						heartbeatTimer = setInterval(() => {
							if (stopped || closing || incoming.readyState !== WebSocket.OPEN) return;
							if (Date.now() - lastClientActivity >= (options.clientHeartbeatTimeoutMs ?? 60000)) {
								options.onDiagnostic?.({ code: 'client_heartbeat_timeout' });
								beginClose(1001, "Client heartbeat timed out");
								return;
							}
							try { incoming.ping(); } catch (error) { wsError(error); }
						}, options.clientHeartbeatIntervalMs ?? 15000);
						heartbeatTimer.unref();
						clearTimeout(handshakeTimer);
						incoming.resume();
						resolve();
					});
				} catch (error) {
					stop(error instanceof Error ? error : /* @__PURE__ */ new Error("Client WebSocket upgrade failed"));
				}
			});
		} catch (error) {
			stop(error instanceof Error ? error : /* @__PURE__ */ new Error("WebSocket bridge setup failed"));
		}
	});
}
