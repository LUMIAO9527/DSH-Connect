// DSH Connect connection core. Adapted from dsh-mobile 0.6.18 (Apache-2.0).
// Maintained in this project; see ../NOTICE and ../LICENSE.
function isStrictIpv4(value) {
    const parts = value.split('.');
    if (parts.length !== 4) return false;
    for (const part of parts){
        if (!/^(?:0|[1-9][0-9]{0,2})$/u.test(part)) return false;
        if (Number(part) > 255) return false;
    }
    return true;
}
function countIpv6Groups(labels, allowDottedQuad) {
    let groups = 0;
    for(let index = 0; index < labels.length; index += 1){
        const label = labels[index];
        if (label.includes('.')) {
            if (index !== labels.length - 1 || !allowDottedQuad || !isStrictIpv4(label)) return -1;
            groups += 2;
            continue;
        }
        if (!/^[\da-f]{1,4}$/iu.test(label)) return -1;
        groups += 1;
    }
    return groups;
}
export function isIP(value) {
    if (typeof value !== 'string') return 0;
    if (isStrictIpv4(value)) return 4;
    let text = value;
    const zone = text.indexOf('%');
    if (zone !== -1) {
        const suffix = text.slice(zone + 1);
        if (suffix.length === 0 || suffix.includes('%')) return 0;
        text = text.slice(0, zone);
    }
    if (text.length === 0) return 0;
    const halves = text.split('::');
    if (halves.length > 2) return 0;
    if (halves.length === 1) {
        return countIpv6Groups(text.split(':'), true) === 8 ? 6 : 0;
    }
    const leftText = halves[0];
    const rightText = halves[1];
    const left = leftText === '' ? [] : leftText.split(':');
    const right = rightText === '' ? [] : rightText.split(':');
    const leftGroups = countIpv6Groups(left, false);
    const rightGroups = countIpv6Groups(right, right.length > 0);
    if (leftGroups < 0 || rightGroups < 0) return 0;
    return leftGroups + rightGroups >= 8 ? 0 : 6;
}
