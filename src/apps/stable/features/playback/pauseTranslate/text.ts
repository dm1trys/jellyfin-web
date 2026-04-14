const isDigit = (char: string) => /[0-9]/.test(char);

const isLetter = (char: string) => {
    const upper = char.toUpperCase();
    const lower = char.toLowerCase();
    return upper !== lower;
};

const isWordChar = (char: string) => isDigit(char) || isLetter(char);

const isLowercaseLetter = (char: string) => isLetter(char) && char === char.toLowerCase() && char !== char.toUpperCase();

const isUppercaseLetter = (char: string) => isLetter(char) && char === char.toUpperCase() && char !== char.toLowerCase();

const separateWordBoundaries = (text: string) => {
    let normalized = '';

    for (let index = 0; index < text.length; index += 1) {
        const current = text[index];
        const next = text[index + 1];

        normalized += current;

        if (!next) {
            continue;
        }

        if (isLowercaseLetter(current) && isUppercaseLetter(next)) {
            normalized += ' ';
        }
    }

    return normalized;
};

export const normalizeSubtitleText = (text: string) => separateWordBoundaries(text
    .replace(/\{\\[^}]+\}/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\r/g, '')
    .replace(/[\u200E\u200F\u202A-\u202E]/g, '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .join(' ')
    .replace(/\s{2,}/g, ' '))
    .normalize('NFC')
    .trim();

export const tokenizeWords = (text: string) => {
    const tokens: string[] = [];
    let current = '';

    for (const char of text) {
        if (isWordChar(char)) {
            current += char;
            continue;
        }

        if ((char === '\'' || char === '’' || char === '-') && current) {
            current += char;
            continue;
        }

        if (current) {
            tokens.push(current.replace(/['’-]+$/g, ''));
            current = '';
        }
    }

    if (current) {
        tokens.push(current.replace(/['’-]+$/g, ''));
    }

    return tokens.filter(Boolean);
};

export const titleCase = (value: string) => (
    value.charAt(0).toUpperCase() + value.slice(1)
);

export const inferPartOfSpeech = (word: string) => {
    const lower = word.toLowerCase();

    if (/(ing|ed)$/.test(lower)) return 'verb';
    if (/ly$/.test(lower)) return 'adverb';
    if (/(ous|ful|able|al|ive|less|ic)$/.test(lower)) return 'adjective';
    if (/(tion|ment|ness|ship|ity|er|or)$/.test(lower)) return 'noun';
    return 'word';
};

export const uniqueValues = (values: Array<string | undefined | null>) => values
    .filter((value): value is string => Boolean(value))
    .map((value) => value.trim())
    .filter(Boolean)
    .filter((value, index, list) => list.indexOf(value) === index);
