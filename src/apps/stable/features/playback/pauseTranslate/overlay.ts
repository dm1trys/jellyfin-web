import type { OverlayTone, WordInspectorEntry } from './types';
import { tokenizeWords } from './text';

const OVERLAY_CLASS = 'pauseTranslateOverlay';
const WORD_BUTTON_CLASS = `${OVERLAY_CLASS}-word`;
const WORD_BUTTON_ACTIVE_CLASS = `${WORD_BUTTON_CLASS}-active`;

export class PauseTranslateOverlay {
    private overlay?: HTMLDivElement;
    private originalNode?: HTMLDivElement;
    private translatedNode?: HTMLDivElement;
    private wordsNode?: HTMLDivElement;
    private inspectorNode?: HTMLDivElement;
    private inspectorWordNode?: HTMLDivElement;
    private inspectorPartOfSpeechNode?: HTMLDivElement;
    private inspectorMetaNode?: HTMLDivElement;
    private inspectorContextNode?: HTMLDivElement;
    private inspectorTranslationsNode?: HTMLDivElement;
    private currentOriginal = '';
    private selectedWord?: string;

    constructor(private readonly onWordSelect: (word: string) => void) {
        this.ensure();
    }

    setSelectedWord(word?: string) {
        this.selectedWord = word;
        this.renderWordButtons();
    }

    show(original: string, translated: string, tone: OverlayTone = 'ready') {
        this.ensure();
        if (!this.overlay || !this.originalNode || !this.translatedNode) {
            return;
        }

        this.currentOriginal = original;
        this.originalNode.textContent = original;
        this.translatedNode.textContent = translated;
        this.overlay.dataset.tone = tone;
        this.overlay.classList.remove('hide');
        this.renderWordButtons();
    }

    hide() {
        this.overlay?.classList.add('hide');
    }

    renderInspectorLoading(word: string) {
        if (
            !this.inspectorNode
            || !this.inspectorWordNode
            || !this.inspectorPartOfSpeechNode
            || !this.inspectorMetaNode
            || !this.inspectorContextNode
            || !this.inspectorTranslationsNode
        ) {
            return;
        }

        this.inspectorNode.classList.remove('hide');
        this.inspectorWordNode.textContent = word.toLowerCase();
        this.inspectorPartOfSpeechNode.textContent = 'loading';
        this.inspectorMetaNode.innerHTML = '';
        this.inspectorContextNode.textContent = 'Loading word details...';
        this.inspectorTranslationsNode.innerHTML = '';
    }

    renderInspectorEntry(entry: WordInspectorEntry) {
        if (
            !this.inspectorWordNode
            || !this.inspectorPartOfSpeechNode
            || !this.inspectorMetaNode
            || !this.inspectorContextNode
            || !this.inspectorTranslationsNode
        ) {
            return;
        }

        this.inspectorWordNode.textContent = entry.lemma;
        this.inspectorPartOfSpeechNode.textContent = entry.partOfSpeech;
        this.inspectorMetaNode.innerHTML = '';
        this.inspectorContextNode.textContent = entry.contextualMeaning;
        this.inspectorTranslationsNode.innerHTML = '';

        for (const grammarTag of entry.grammarTags || []) {
            const chip = document.createElement('div');
            chip.className = `${OVERLAY_CLASS}-meta-chip`;
            chip.textContent = grammarTag;
            this.inspectorMetaNode.appendChild(chip);
        }

        for (const translation of entry.translations) {
            const chip = document.createElement('div');
            chip.className = `${OVERLAY_CLASS}-translation-chip`;
            chip.textContent = translation;
            this.inspectorTranslationsNode.appendChild(chip);
        }
    }

    private ensure() {
        if (this.overlay) {
            return;
        }

        this.overlay = document.createElement('div');
        this.overlay.className = `${OVERLAY_CLASS} hide`;

        this.originalNode = document.createElement('div');
        this.originalNode.className = `${OVERLAY_CLASS}-original`;

        this.translatedNode = document.createElement('div');
        this.translatedNode.className = `${OVERLAY_CLASS}-translated`;

        this.wordsNode = document.createElement('div');
        this.wordsNode.className = `${OVERLAY_CLASS}-words`;

        this.inspectorNode = document.createElement('div');
        this.inspectorNode.className = `${OVERLAY_CLASS}-inspector`;

        this.inspectorWordNode = document.createElement('div');
        this.inspectorWordNode.className = `${OVERLAY_CLASS}-inspector-word`;

        this.inspectorPartOfSpeechNode = document.createElement('div');
        this.inspectorPartOfSpeechNode.className = `${OVERLAY_CLASS}-inspector-pos`;

        this.inspectorMetaNode = document.createElement('div');
        this.inspectorMetaNode.className = `${OVERLAY_CLASS}-inspector-meta`;

        this.inspectorContextNode = document.createElement('div');
        this.inspectorContextNode.className = `${OVERLAY_CLASS}-inspector-context`;

        this.inspectorTranslationsNode = document.createElement('div');
        this.inspectorTranslationsNode.className = `${OVERLAY_CLASS}-inspector-translations`;

        this.inspectorNode.append(
            this.inspectorWordNode,
            this.inspectorPartOfSpeechNode,
            this.inspectorMetaNode,
            this.inspectorContextNode,
            this.inspectorTranslationsNode
        );

        this.overlay.append(this.originalNode, this.translatedNode, this.wordsNode, this.inspectorNode);
        this.overlay.addEventListener('click', this.handleClick);
        document.body.appendChild(this.overlay);
    }

    private renderWordButtons() {
        if (!this.wordsNode) {
            return;
        }

        this.wordsNode.innerHTML = '';

        for (const word of tokenizeWords(this.currentOriginal)) {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = WORD_BUTTON_CLASS;
            button.dataset.word = word;
            button.textContent = word;

            if (word === this.selectedWord) {
                button.classList.add(WORD_BUTTON_ACTIVE_CLASS);
            }

            this.wordsNode.appendChild(button);
        }
    }

    private readonly handleClick = (event: Event) => {
        const target = event.target;
        if (!(target instanceof HTMLElement)) {
            return;
        }

        const wordButton = target.closest(`.${WORD_BUTTON_CLASS}`);
        if (!(wordButton instanceof HTMLButtonElement) || !wordButton.dataset.word) {
            return;
        }

        this.onWordSelect(wordButton.dataset.word);
    };
}
