import { App, Modal, Setting } from 'obsidian';
import { DiscoveredNote } from '../types/context';

export class ContextSelectionModal extends Modal {
  private discoveredNotes: DiscoveredNote[];
  private onSubmit: (selectedNotes: DiscoveredNote[]) => void;
  private checkboxStates: Map<string, boolean>;
  private summaryEl: HTMLElement;

  constructor(
    app: App,
    discoveredNotes: DiscoveredNote[],
    onSubmit: (selectedNotes: DiscoveredNote[]) => void
  ) {
    super(app);
    this.discoveredNotes = discoveredNotes;
    this.onSubmit = onSubmit;
    this.checkboxStates = new Map();

    // Initialize checkbox states from included property
    discoveredNotes.forEach(note => {
      this.checkboxStates.set(note.file.path, note.included);
    });
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass('openaugi-selection-modal');

    contentEl.createEl('h2', { text: 'Select notes to include' });

    contentEl.createEl('p', {
      text: 'Review and select which notes to include in the gathered context.',
      cls: 'setting-item-description'
    });

    // Summary stats
    this.summaryEl = contentEl.createDiv({ cls: 'openaugi-selection-summary' });
    this.updateSummary();

    // Select all / Deselect all buttons
    new Setting(contentEl)
      .setName('Quick actions')
      .addButton(button => button
        .setButtonText('Select all')
        .onClick(() => {
          this.discoveredNotes.forEach(note => {
            this.checkboxStates.set(note.file.path, true);
          });
          this.renderNoteList();
        })
      )
      .addButton(button => button
        .setButtonText('Deselect all')
        .onClick(() => {
          this.discoveredNotes.forEach(note => {
            this.checkboxStates.set(note.file.path, false);
          });
          this.renderNoteList();
        })
      );

    // Scrollable list of checkboxes
    const listContainer = contentEl.createDiv({ cls: 'openaugi-note-list-container' });

    this.renderNoteListInContainer(listContainer);

    // Action buttons
    const totalSelected = Array.from(this.checkboxStates.values()).filter(v => v).length;

    new Setting(contentEl)
      .addButton(button => button
        .setButtonText('Back')
        .onClick(() => this.close())
      )
      .addButton(button => button
        .setButtonText('Continue')
        .setCta()
        .setDisabled(totalSelected === 0)
        .onClick(() => {
          // Update included property based on checkboxes
          this.discoveredNotes.forEach(note => {
            note.included = this.checkboxStates.get(note.file.path) || false;
          });
          this.onSubmit(this.discoveredNotes.filter(n => n.included));
          this.close();
        })
      );
  }

  private renderNoteList() {
    // Find and re-render the list container
    const listContainer = this.contentEl.querySelector('.note-list-container');
    if (listContainer) {
      listContainer.empty();
      this.renderNoteListInContainer(listContainer as HTMLElement);
    }
    this.updateSummary();
  }

  private renderNoteListInContainer(listContainer: HTMLElement) {
    // Group by depth for linked notes
    const byDepth = new Map<number, DiscoveredNote[]>();
    this.discoveredNotes.forEach(note => {
      if (!byDepth.has(note.depth)) {
        byDepth.set(note.depth, []);
      }
      byDepth.get(note.depth)!.push(note);
    });

    // Render notes grouped by depth
    const sortedDepths = Array.from(byDepth.keys()).sort((a, b) => a - b);

    sortedDepths.forEach(depth => {
      const notes = byDepth.get(depth)!;

      // Depth header
      if (sortedDepths.length > 1 && depth > 0) {
        listContainer.createDiv({
          cls: 'openaugi-depth-header',
          text: `📁 Level ${depth}`
        });
      } else if (depth === 0 && sortedDepths.length > 1) {
        listContainer.createDiv({
          cls: 'openaugi-depth-header openaugi-depth-header-root',
          text: '📄 Root note'
        });
      }

      // Notes at this depth
      notes.forEach(note => {
        const noteEl = listContainer.createDiv({ cls: 'openaugi-note-row' });
        // Indentation is the only per-note dynamic style, so it goes through a
        // custom property rather than a hardcoded class.
        noteEl.setCssProps({ '--openaugi-note-indent': `${depth * 20}px` });

        const checkbox = noteEl.createEl('input', {
          type: 'checkbox',
          cls: 'openaugi-note-checkbox'
        });
        checkbox.checked = this.checkboxStates.get(note.file.path) || false;
        checkbox.addEventListener('change', () => {
          this.checkboxStates.set(note.file.path, checkbox.checked);
          this.updateSummary();
        });

        // Make the whole row clickable
        noteEl.addEventListener('click', (e) => {
          if (e.target !== checkbox) {
            checkbox.checked = !checkbox.checked;
            this.checkboxStates.set(note.file.path, checkbox.checked);
            this.updateSummary();
          }
        });

        const contentDiv = noteEl.createDiv({ cls: 'openaugi-note-body' });

        const titleRow = contentDiv.createDiv({ cls: 'openaugi-note-title-row' });

        titleRow.createSpan({
          text: note.file.basename,
          cls: 'openaugi-note-item-title'
        });

        // Backlink indicator badge
        if (note.isBacklink) {
          titleRow.createSpan({
            text: '← backlink',
            cls: 'openaugi-backlink-badge'
          });
        }

        const sizeKb = (note.estimatedChars / 1000).toFixed(1);
        const contentType = note.isBacklink ? 'snippet' : 'full note';
        contentDiv.createSpan({
          text: `${sizeKb}k chars (${contentType}) · ${note.discoveredVia}`,
          cls: 'openaugi-note-item-meta'
        });
      });
    });

    // Show message if no notes
    if (this.discoveredNotes.length === 0) {
      listContainer.createDiv({
        cls: 'openaugi-empty-state',
        text: 'No notes discovered'
      });
    }
  }

  private updateSummary() {
    const totalSelected = Array.from(this.checkboxStates.values()).filter(v => v).length;
    const totalChars = this.discoveredNotes
      .filter(n => this.checkboxStates.get(n.file.path))
      .reduce((sum, n) => sum + n.estimatedChars, 0);

    this.summaryEl.setText(
      `✓ Selected: ${totalSelected} of ${this.discoveredNotes.length} notes (${totalChars.toLocaleString()} characters, ~${Math.ceil(totalChars / 4).toLocaleString()} tokens)`
    );
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}
