const defaultRedactedText = '-----------------------------------------------------------------\nRedacted for brevity\n-----------------------------------------------------------------';

const redactLines = (str, maxLines = 500, startLines = 10, endLines = 100) => {
    if (!str) {
        return '';
    }
    const lines = str.replace(/(\r\n|\n|\r)/gm, '\n').split(/\n/);
    const minLines = startLines + endLines;
    if (lines.length <= minLines) {
        return str;
    }
    if (lines.length <= maxLines) {
        return str;
    }
    const linesToDelete = lines.length - maxLines;
    if (linesToDelete <= 0) {
        return str;
    }
    lines.splice(startLines, linesToDelete, defaultRedactedText);
    const joined = lines.join('\n');
    return joined;
};

module.exports = {
    redactLines
};
