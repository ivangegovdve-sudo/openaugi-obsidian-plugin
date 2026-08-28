import { App, Modal, Notice, Setting } from 'obsidian';
import { GatheredContext } from '../types/context';

export class ContextPreviewModal extends Modal {
  private context: GatheredContext;
  private onSaveRaw: () => void;
  private onProcess: () => void;
  private processButtonLabel: string;

  constructor(
    app: App,
    context: GatheredContext,
    onSaveRaw: () => void,
    onProcess: () => void,
    processButtonLabel: string = 'Process with AI'
  ) {
    super(app);
    this.context = context;
    this.onSaveRaw = onSaveRaw;
    this.onProcess = onProcess;
    this.processButtonLabel = processButtonLabel;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass('openaugi-preview-modal');

    contentEl.createEl('h2', { text: 'Context preview' });

    contentEl.createEl('p', {
      text: 'Review the gathered context before processing or saving.',
      cls: 'setting-item-description'
    });

    // Summary stats
    const statsEl = contentEl.createDiv({ cls: 'openaugi-context-stats' });

    statsEl.createEl('h3', { text: '📊 Summary', cls: 'openaugi-stats-title' });

    statsEl.createEl('p', {
      text: `Notes: ${this.context.totalNotes} notes`
    });
    statsEl.createEl('p', {
      text: `Characters: ${this.context.totalCharacters.toLocaleString()}`
    });
    statsEl.createEl('p', {
      text: `Estimated tokens: ~${Math.ceil(this.context.totalCharacters / 4).toLocaleString()}`
    });
    statsEl.createEl('p', {
      text: `Source: ${this.context.config.sourceMode === 'linked-notes' ? 'Linked notes' : 'Recent activity'}`
    });

    if (this.context.config.sourceMode === 'linked-notes') {
      statsEl.createEl('p', {
        text: `Link depth: ${this.context.config.linkDepth}`
      });
    }

    // List of included notes
    const notesListEl = contentEl.createDiv({ cls: 'openaugi-notes-list' });

    notesListEl.createEl('h3', { text: '📝 Included notes' });

    const listEl = notesListEl.createEl('ul', { cls: 'openaugi-note-items' });

    this.context.notes.forEach(note => {
      const itemEl = listEl.createEl('li', { cls: 'openaugi-note-item' });

      itemEl.createSpan({
        text: note.file.basename,
        cls: 'openaugi-note-item-title'
      });

      if (note.depth > 0) {
        itemEl.createSpan({
          text: ` (L${note.depth})`,
          cls: 'openaugi-note-item-meta'
        });
      }

      itemEl.createSpan({
        text: ` · ${(note.estimatedChars / 1000).toFixed(1)}k chars`,
        cls: 'openaugi-note-item-meta'
      });
    });

    // Content preview (first 1000 chars)
    const previewEl = contentEl.createDiv({ cls: 'openaugi-content-preview' });

    previewEl.createEl('h3', { text: '👁️ Content preview' });

    const preText = previewEl.createEl('pre', { cls: 'openaugi-preview-text' });

    const preview = this.context.aggregatedContent.substring(0, 1000);
    const hasMore = this.context.aggregatedContent.length > 1000;
    preText.setText(preview + (hasMore ? '\n\n...(truncated)' : ''));

    // Action buttons
    new Setting(contentEl)
      .addButton(button => button
        .setButtonText('Back')
        .onClick(() => this.close())
      )
      .addButton(button => button
        .setButtonText('Copy to clipboard')
        .setTooltip('Copy the gathered context to clipboard')
        .onClick(async () => {
          await navigator.clipboard.writeText(this.context.aggregatedContent);
          new Notice('Context copied to clipboard!');
          this.close();
        })
      )
      .addButton(button => button
        .setButtonText('Save raw context')
        .setTooltip('Save the gathered context as a note without AI processing')
        .onClick(() => {
          this.onSaveRaw();
          this.close();
        })
      )
      .addButton(button => button
        .setButtonText(this.processButtonLabel)
        .setCta()
        .setTooltip('Continue to process this context with AI')
        .onClick(() => {
          this.onProcess();
          this.close();
        })
      );
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}
