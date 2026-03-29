export const normalizeSubtitleText = (text: string) => text
    .replace(/<[^>]+>/g, ' ')
    .replace(/\r/g, '')
    .replace(/[\u200E\u200F\u202A-\u202E]/g, '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .join('\n')
    .normalize('NFC')
    .trim();

export const tokenizeWords = (text: string) => (
    text.match(/[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu) || []
);

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
