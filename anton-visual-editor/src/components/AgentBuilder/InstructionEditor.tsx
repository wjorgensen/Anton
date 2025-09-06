'use client';

import React, { useRef, useEffect, useState } from 'react';
import * as Monaco from 'monaco-editor/esm/vs/editor/editor.api';
import {
  Code2,
  FileText,
  Copy,
  Download,
  Upload,
  Check,
  AlertCircle,
  Eye,
  EyeOff,
  Maximize2,
  Minimize2,
  Settings,
  Sparkles,
  BookOpen,
  ChevronRight
} from 'lucide-react';

interface InstructionEditorProps {
  value: string;
  onChange: (value: string) => void;
  language?: 'markdown' | 'plaintext' | 'json';
  placeholder?: string;
  height?: string;
  readOnly?: boolean;
  showLineNumbers?: boolean;
  theme?: 'dark' | 'light';
  onSave?: () => void;
}

// Custom Monaco theme for Anton
const ANTON_DARK_THEME: Monaco.editor.IStandaloneThemeData = {
  base: 'vs-dark',
  inherit: true,
  rules: [
    { token: 'comment', foreground: '666666', fontStyle: 'italic' },
    { token: 'keyword', foreground: '3B82F6' },
    { token: 'string', foreground: '10B981' },
    { token: 'number', foreground: 'F59E0B' },
    { token: 'type', foreground: '8B5CF6' },
    { token: 'function', foreground: '60A5FA' },
    { token: 'variable', foreground: 'FFFFFF' },
    { token: 'constant', foreground: 'EF4444' },
    { token: 'tag', foreground: '3B82F6' },
    { token: 'attribute.name', foreground: '10B981' },
    { token: 'attribute.value', foreground: 'F59E0B' },
  ],
  colors: {
    'editor.background': '#0A0A0A',
    'editor.foreground': '#FFFFFF',
    'editor.lineHighlightBackground': '#141414',
    'editor.selectionBackground': '#3B82F644',
    'editor.inactiveSelectionBackground': '#3B82F622',
    'editorCursor.foreground': '#3B82F6',
    'editorLineNumber.foreground': '#666666',
    'editorLineNumber.activeForeground': '#A0A0A0',
    'editor.wordHighlightBackground': '#3B82F622',
    'editor.wordHighlightStrongBackground': '#3B82F644',
    'editorBracketMatch.background': '#3B82F644',
    'editorBracketMatch.border': '#3B82F6',
    'editor.findMatchBackground': '#F59E0B44',
    'editor.findMatchHighlightBackground': '#F59E0B22',
    'editorGutter.background': '#0A0A0A',
    'scrollbar.shadow': '#000000',
    'scrollbarSlider.background': '#26262666',
    'scrollbarSlider.hoverBackground': '#404040',
    'scrollbarSlider.activeBackground': '#3B82F6',
  }
};

const INSTRUCTION_SNIPPETS = [
  {
    label: 'Base Agent Template',
    value: `You are a specialized AI agent designed to {{purpose}}.

## Core Responsibilities
1. {{responsibility1}}
2. {{responsibility2}}
3. {{responsibility3}}

## Guidelines
- Always {{guideline1}}
- Never {{guideline2}}
- Prioritize {{priority}}

## Context
{{contextDescription}}

## Success Criteria
- {{criteria1}}
- {{criteria2}}
- {{criteria3}}`
  },
  {
    label: 'API Developer',
    value: `You are an API development specialist focused on building robust, scalable REST APIs.

## Core Responsibilities
1. Design RESTful endpoints following best practices
2. Implement proper error handling and validation
3. Ensure API security and authentication
4. Write comprehensive API documentation

## Technical Guidelines
- Follow REST conventions (GET, POST, PUT, DELETE)
- Use proper HTTP status codes
- Implement pagination for list endpoints
- Include proper CORS configuration
- Add rate limiting where appropriate

## Code Standards
- Use async/await for asynchronous operations
- Implement proper error middleware
- Add input validation using schemas
- Include unit and integration tests`
  },
  {
    label: 'React Developer',
    value: `You are a React frontend development specialist.

## Core Responsibilities
1. Build responsive, accessible React components
2. Implement efficient state management
3. Optimize performance and bundle size
4. Follow React best practices and patterns

## Technical Guidelines
- Use functional components with hooks
- Implement proper error boundaries
- Optimize re-renders with memo and callbacks
- Follow component composition patterns
- Ensure accessibility (WCAG 2.1 AA)`
  },
  {
    label: 'Test Runner',
    value: `You are a testing specialist focused on comprehensive test coverage.

## Core Responsibilities
1. Write unit tests for all functions/components
2. Create integration tests for APIs
3. Implement E2E tests for critical paths
4. Ensure high code coverage (>80%)

## Testing Strategy
- Follow AAA pattern (Arrange, Act, Assert)
- Mock external dependencies
- Test edge cases and error scenarios
- Use descriptive test names
- Group related tests in describe blocks`
  }
];

export default function InstructionEditor({
  value,
  onChange,
  language = 'markdown',
  placeholder = '',
  height = '400px',
  readOnly = false,
  showLineNumbers = true,
  theme = 'dark',
  onSave
}: InstructionEditorProps) {
  const editorRef = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [showSnippets, setShowSnippets] = useState(false);
  const [copied, setCopied] = useState(false);
  const [wordCount, setWordCount] = useState(0);
  const [lineCount, setLineCount] = useState(0);

  // Initialize Monaco Editor
  useEffect(() => {
    if (!containerRef.current) return;

    // Define custom theme
    Monaco.editor.defineTheme('anton-dark', ANTON_DARK_THEME);

    // Create editor instance
    const editor = Monaco.editor.create(containerRef.current, {
      value: value || placeholder,
      language,
      theme: theme === 'dark' ? 'anton-dark' : 'vs',
      readOnly,
      lineNumbers: showLineNumbers ? 'on' : 'off',
      minimap: { enabled: false },
      scrollBeyondLastLine: false,
      wordWrap: 'on',
      fontSize: 14,
      fontFamily: "'JetBrains Mono', 'SF Mono', Monaco, monospace",
      padding: { top: 16, bottom: 16 },
      automaticLayout: true,
      tabSize: 2,
      insertSpaces: true,
      formatOnPaste: true,
      formatOnType: true,
      suggestOnTriggerCharacters: true,
      quickSuggestions: {
        other: true,
        comments: false,
        strings: true
      },
      scrollbar: {
        vertical: 'visible',
        horizontal: 'visible',
        verticalScrollbarSize: 8,
        horizontalScrollbarSize: 8
      }
    });

    editorRef.current = editor;

    // Handle content changes
    editor.onDidChangeModelContent(() => {
      const content = editor.getValue();
      onChange(content);
      updateStats(content);
    });

    // Add keyboard shortcuts
    editor.addCommand(Monaco.KeyMod.CtrlCmd | Monaco.KeyCode.KEY_S, () => {
      onSave?.();
    });

    // Initial stats
    updateStats(value);

    return () => {
      editor.dispose();
    };
  }, []);

  // Update editor value when prop changes
  useEffect(() => {
    if (editorRef.current && value !== editorRef.current.getValue()) {
      editorRef.current.setValue(value);
    }
  }, [value]);

  const updateStats = (content: string) => {
    const words = content.trim().split(/\s+/).filter(Boolean).length;
    const lines = content.split('\n').length;
    setWordCount(words);
    setLineCount(lines);
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([value], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `instructions-${Date.now()}.${language === 'markdown' ? 'md' : 'txt'}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        onChange(content);
      };
      reader.readAsText(file);
    }
  };

  const insertSnippet = (snippet: string) => {
    if (editorRef.current) {
      const position = editorRef.current.getPosition();
      if (position) {
        editorRef.current.executeEdits('insert-snippet', [{
          range: new Monaco.Range(position.lineNumber, position.column, position.lineNumber, position.column),
          text: snippet,
          forceMoveMarkers: true
        }]);
        editorRef.current.focus();
      }
    }
    setShowSnippets(false);
  };

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  return (
    <div className={`${isFullscreen ? 'fixed inset-0 z-50 bg-black' : ''} flex flex-col`}>
      {/* Toolbar */}
      <div className="border-b border-[#262626] bg-[#0A0A0A] p-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowSnippets(!showSnippets)}
            className="p-2 text-gray-400 hover:text-white hover:bg-[#141414] rounded transition-colors"
            title="Insert Snippet"
          >
            <Sparkles className="w-4 h-4" />
          </button>
          
          <button
            onClick={() => setShowPreview(!showPreview)}
            className="p-2 text-gray-400 hover:text-white hover:bg-[#141414] rounded transition-colors"
            title={showPreview ? 'Hide Preview' : 'Show Preview'}
          >
            {showPreview ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>

          <div className="w-px h-6 bg-[#262626]" />

          <button
            onClick={handleCopy}
            className="p-2 text-gray-400 hover:text-white hover:bg-[#141414] rounded transition-colors"
            title="Copy"
          >
            {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
          </button>

          <button
            onClick={handleDownload}
            className="p-2 text-gray-400 hover:text-white hover:bg-[#141414] rounded transition-colors"
            title="Download"
          >
            <Download className="w-4 h-4" />
          </button>

          <label className="p-2 text-gray-400 hover:text-white hover:bg-[#141414] rounded transition-colors cursor-pointer">
            <input
              type="file"
              accept=".txt,.md,.json"
              onChange={handleUpload}
              className="hidden"
            />
            <Upload className="w-4 h-4" />
          </label>

          <div className="w-px h-6 bg-[#262626]" />

          <button
            onClick={toggleFullscreen}
            className="p-2 text-gray-400 hover:text-white hover:bg-[#141414] rounded transition-colors"
            title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>

        <div className="flex items-center gap-4 text-xs text-gray-500">
          <span>{wordCount} words</span>
          <span>{lineCount} lines</span>
          {language && (
            <span className="px-2 py-1 bg-[#141414] rounded text-gray-400">
              {language}
            </span>
          )}
        </div>
      </div>

      {/* Snippets Panel */}
      {showSnippets && (
        <div className="border-b border-[#262626] bg-[#0A0A0A] p-3 max-h-48 overflow-y-auto">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-400">Instruction Templates</span>
            <button
              onClick={() => setShowSnippets(false)}
              className="text-gray-400 hover:text-white"
            >
              ×
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {INSTRUCTION_SNIPPETS.map((snippet, index) => (
              <button
                key={index}
                onClick={() => insertSnippet(snippet.value)}
                className="px-3 py-2 bg-[#141414] hover:bg-[#1A1A1A] rounded text-left text-sm text-gray-300 hover:text-white transition-colors flex items-center gap-2"
              >
                <ChevronRight className="w-3 h-3" />
                {snippet.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className={`flex-1 flex ${showPreview ? 'divide-x divide-[#262626]' : ''}`}>
        {/* Editor */}
        <div
          ref={containerRef}
          className={showPreview ? 'w-1/2' : 'w-full'}
          style={{ height: isFullscreen ? 'calc(100vh - 100px)' : height }}
        />

        {/* Preview Panel */}
        {showPreview && language === 'markdown' && (
          <div className="w-1/2 p-4 overflow-y-auto bg-[#0A0A0A]">
            <div className="prose prose-invert max-w-none">
              {/* Markdown preview would be rendered here */}
              <p className="text-gray-400">Markdown preview would appear here...</p>
            </div>
          </div>
        )}
      </div>

      {/* Status Bar */}
      {onSave && (
        <div className="border-t border-[#262626] bg-[#0A0A0A] px-3 py-1 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <kbd className="px-1.5 py-0.5 bg-[#141414] rounded text-gray-400">Cmd+S</kbd>
            <span>to save</span>
          </div>
          <button
            onClick={onSave}
            className="px-3 py-1 bg-[#3B82F6] text-white text-xs rounded hover:bg-[#60A5FA] transition-colors"
          >
            Save Changes
          </button>
        </div>
      )}
    </div>
  );
}