import { ViewPlugin, Decoration, DecorationSet, EditorView, WidgetType } from '@codemirror/view';
import { RangeSetBuilder, Prec } from '@codemirror/state';
import { keymap } from '@codemirror/view';
import type { ViewUpdate } from '@codemirror/view';
import type { Text } from '@codemirror/state';
import { aiRouter } from '../../lib/ai-router';

// Constants
const MIN_REQUEST_INTERVAL = 500; // Minimum 500ms between requests
const AI_CONFIG_CACHE_TTL = 30000; // 30 seconds cache for AI config
const WHITESPACE_REGEX = /\s+/; // Pre-compiled regex
const CLEANUP_REGEX = /^["']|["']$|\.{3,}|…/g; // Combined cleanup regex


// AI Configuration Cache
let aiConfigCache: { value: boolean; timestamp: number } | null = null;

// State management class
class PredictionState {
  currentPrediction: string = '';
  currentPredictionPos: number = -1;
  predictionPending: boolean = false;
  lastRequestTime: number = 0;
  abortController: AbortController | null = null;
  
  clear() {
    this.currentPrediction = '';
    this.currentPredictionPos = -1;
  }
  
  abort() {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }
}

// Global state (for keymap access) - will be set by plugin instance
let globalState: PredictionState | null = null;

// Widget for displaying prediction as inline ghost text
class PredictionWidget extends WidgetType {
  constructor(readonly prediction: string) {
    super();
  }

  eq(other: PredictionWidget) {
    return other.prediction === this.prediction;
  }

  toDOM() {
    const span = document.createElement('span');
    // Add space here for visual display only
    span.textContent = ' ' + this.prediction;
    span.className = 'cm-prediction-text';
    return span;
  }

  ignoreEvent() {
    return true;
  }
}

// Check if AI is configured and available (with caching)
async function isAIConfigured(): Promise<boolean> {
  const now = Date.now();
  
  // Return cached value if still valid
  if (aiConfigCache && (now - aiConfigCache.timestamp) < AI_CONFIG_CACHE_TTL) {
    return aiConfigCache.value;
  }
  
  try {
    const status = await aiRouter.getConnectionStatus();
    const result = status.connected && status.provider !== 'none';
    
    // Cache the result
    aiConfigCache = { value: result, timestamp: now };
    return result;
  } catch (error) {
    return false;
  }
}

// Extract approximately N words before cursor position (optimized)
// Works backwards from cursor to avoid processing entire document
function extractWordsBeforeCursor(doc: Text, cursorPos: number, wordCount: number): string {
  if (cursorPos === 0) return '';
  
  // Estimate: average word is 5 chars + 1 space = 6 chars
  // Add buffer for safety (2x)
  const estimatedChars = Math.min(wordCount * 12, cursorPos);
  const startPos = Math.max(0, cursorPos - estimatedChars);
  
  // Extract the substring
  const text = doc.sliceString(startPos, cursorPos);
  
  // Split and take last N words
  const words = text.split(WHITESPACE_REGEX).filter((w: string) => w.length > 0);
  const recentWords = words.slice(-wordCount);
  
  return recentWords.join(' ');
}

// Generate prediction using AIRouter
async function generatePrediction(context: string, signal?: AbortSignal): Promise<string> {
  try {
    const systemPrompt = `You are a text completion assistant. continue the user's text input with a short, relevant prediction, the prediction needs to follow the user's input naturally as if he is continuing to write. do not include anything other than the predicted text. avoid starting with repeated words from the input. keep the prediction concise and to the point.`;
    
    const userPrompt = `${context}`;

    const response = await aiRouter.chatCompletion({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      options: {
        stream: false,
        temperature: 0.5,      // Increased for more creativity
        maxTokens: 15,         // Reduced to force conciseness
        topP: 0.7,             // Increased for a wider choice of words
        frequencyPenalty: 1.5, // Increased to more strongly discourage repetition
        presencePenalty: 0.0,  // Removed for now to reduce over-constraining
      }
    });

    // Check if request was aborted
    if (signal?.aborted) {
      return '';
    }


    // Clean up the response - optimized with single regex pass
    let prediction = response.content
      .replace(CLEANUP_REGEX, '') // Remove quotes, ellipsis in one pass
      .trim();
    

    // Limit to approximately 5 words
    const words = prediction.split(WHITESPACE_REGEX).slice(0, 5);
    prediction = words.join(' ');

    // Get unique words from the context for more aggressive repetition filtering
    const contextWords = context.split(WHITESPACE_REGEX).filter(w => w.length > 0);
    const contextWordsSet = new Set(contextWords.map(w => w.toLowerCase()));

    let predictionWordsFiltered = prediction.split(WHITESPACE_REGEX)
                                            .filter(w => w.length > 0);

    // First, handle the last input word repetition (as before)
    const lastContextWord = contextWords.length > 0 ? contextWords[contextWords.length - 1] : '';
    const firstPredictionWord = predictionWordsFiltered.length > 0 ? predictionWordsFiltered[0] : '';

    if (lastContextWord && firstPredictionWord && lastContextWord.toLowerCase() === firstPredictionWord.toLowerCase()) {
      predictionWordsFiltered.shift();
    }

    // Now, filter out any other words from the prediction that are in the context
    predictionWordsFiltered = predictionWordsFiltered.filter(word => !contextWordsSet.has(word.toLowerCase()));

    prediction = predictionWordsFiltered.join(' ');

    return prediction;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return '';
    }
    return '';
  }
}

// Update prediction with state management and abort controller
async function updatePrediction(view: EditorView, cursorPos: number, state: PredictionState) {

  // Check if AI is configured and connected
  const configured = await isAIConfigured();
  if (!configured) {
    state.clear();
    return;
  }

  // Rate limiting - don't make requests too frequently
  const now = Date.now();
  if (now - state.lastRequestTime < MIN_REQUEST_INTERVAL) {
    return;
  }

  // Don't generate prediction if already pending
  if (state.predictionPending) {
    return;
  }

  // Abort any previous request
  state.abort();

  // Extract context using optimized function
  const context = extractWordsBeforeCursor(view.state.doc, cursorPos, 150);
  const wordCount = context.split(WHITESPACE_REGEX).length;


  // Need at least some context to make a prediction
  if (wordCount < 3) {
    state.clear();
    return;
  }

  state.predictionPending = true;
  state.lastRequestTime = now;
  state.abortController = new AbortController();
  

  try {
    const prediction = await generatePrediction(context, state.abortController.signal);
    
    // Check if aborted
    if (state.abortController.signal.aborted) {
      return;
    }
    
    // Store the prediction with the position it was requested for.
    // The rendering logic will handle showing it only when the cursor is at the correct position.
    state.currentPrediction = prediction || '';
    state.currentPredictionPos = cursorPos; // Use original cursor position

    // Trigger a view update to potentially show the prediction
    view.dispatch({
      selection: view.state.selection // Keep current selection to trigger update
    });

  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return;
    }
    state.clear();
  } finally {
    state.predictionPending = false;
    state.abortController = null;
  }
}

// Plugin to show predictions
export const predictTextPlugin = ViewPlugin.fromClass(class {
  decorations: DecorationSet;
  updateTimeout: number | null = null;
  state: PredictionState;

  constructor(view: EditorView) {
    this.state = new PredictionState();
    globalState = this.state; // Set global state for keymap access
    this.decorations = this.buildDecorations(view);

    // Check AI connection on startup (async, non-blocking)
    aiRouter.getConnectionStatus().then(status => {
      if (status.connected && status.provider !== 'none') {
      } else {
      }
    });
  }

  update(update: ViewUpdate) {
    // Only process text changes (not just selection changes)
    if (update.docChanged) {
      const cursorPos = update.state.selection.main.head;
      const changes = update.changes;

      // Analyze the changes to understand what happened
      let totalInserted = 0;
      let totalDeleted = 0;
      let insertedText = '';

      changes.iterChangedRanges((fromA: number, toA: number, fromB: number, toB: number) => {
        const deletedLen = toA - fromA;
        const insertedLen = toB - fromB;

        totalDeleted += deletedLen;
        totalInserted += insertedLen;

        if (insertedLen > 0) {
          insertedText += update.state.doc.sliceString(fromB, toB);
        }
      });

      const netChange = totalInserted - totalDeleted;
      // Consider it typing if we have a net positive change and some text was inserted
      // Allow for some deletions (like auto-correct or word replacement)
      const isTyping = netChange >= 0 && insertedText.length > 0;


      if (isTyping) {
        // Clear any existing timeout and set a new one
        if (this.updateTimeout) {
          clearTimeout(this.updateTimeout);
        }

        // Debounce - trigger prediction when user pauses
        this.updateTimeout = window.setTimeout(() => {
          updatePrediction(update.view, cursorPos, this.state);
          this.updateTimeout = null; // Clear the timeout reference
        }, 500); // 500ms debounce - gives more time before triggering prediction
      } else {
        // Text was deleted or modified, clear prediction and timeout
        this.state.clear();

        if (this.updateTimeout) {
          clearTimeout(this.updateTimeout);
          this.updateTimeout = null;
        }
      }

      // Rebuild decorations when document changes
      this.decorations = this.buildDecorations(update.view);
    } else if (update.selectionSet && this.state.currentPrediction) {
      // Only rebuild decorations on selection change if we have a prediction
      // (to hide/show prediction based on cursor position)
      this.decorations = this.buildDecorations(update.view);
    }
  }

  buildDecorations(view: EditorView): DecorationSet {
    const builder = new RangeSetBuilder<Decoration>();
    const cursorPos = view.state.selection.main.head;


    // Show prediction only if we have one and cursor is at the prediction position
    if (this.state.currentPrediction && this.state.currentPredictionPos === cursorPos && this.state.currentPrediction.length > 0) {
      const widget = Decoration.widget({
        widget: new PredictionWidget(this.state.currentPrediction),
        side: 1 // Place after cursor
      });

      builder.add(cursorPos, cursorPos, widget);
    }
    // Only log when there's a prediction but it's not being shown (debugging cursor mismatch)
    else if (this.state.currentPrediction && this.state.currentPredictionPos !== cursorPos) {
    }

    return builder.finish();
  }

  destroy() {
    // Clean up resources
    if (this.updateTimeout) {
      clearTimeout(this.updateTimeout);
    }
    this.state.abort(); // Cancel any pending requests
    if (globalState === this.state) {
      globalState = null;
    }
  }
}, {
  decorations: v => v.decorations
});

// Key handler for Tab to accept prediction
// Use Prec.highest() to ensure this keymap is processed before default Tab indentation
export const acceptPredictionKeymap = Prec.highest(keymap.of([
  {
    key: 'Tab',
    run: (view: EditorView) => {
      if (!globalState) return false;
      
      const cursorPos = view.state.selection.main.head;


      // Only accept if there's a prediction at current cursor position
      if (globalState.currentPrediction && globalState.currentPredictionPos === cursorPos && globalState.currentPrediction.length > 0) {

        // Check if we need to add a space before the prediction
        let textToInsert = globalState.currentPrediction;
        if (cursorPos > 0) {
          const charBefore = view.state.doc.sliceString(cursorPos - 1, cursorPos);
          // Check if the character before cursor is a letter (a-z, A-Z)
          const isLetter = /[a-zA-Z]/.test(charBefore);
          
          if (isLetter) {
            // Add space before prediction if previous char is a letter
            textToInsert = ' ' + globalState.currentPrediction;
          } else {
          }
        }

        // Insert the prediction with or without space
        view.dispatch({
          changes: {
            from: cursorPos,
            to: cursorPos,
            insert: textToInsert
          },
          selection: {
            anchor: cursorPos + textToInsert.length,
            head: cursorPos + textToInsert.length
          }
        });

        // Clear the prediction
        globalState.clear();

        return true; // Handled - prevent default Tab behavior
      }

      return false; // Not handled, let default Tab behavior work
    }
  }
]));

// Export function to check if prediction is available
export function hasPrediction(): boolean {
  return globalState ? globalState.currentPrediction.length > 0 : false;
}

// Export function to clear prediction manually
export function clearPrediction(): void {
  if (globalState) {
    globalState.clear();
  }
}

