'use client';

import React, { useState } from 'react';
import {
  Plus,
  Trash2,
  ChevronDown,
  ChevronRight,
  Copy,
  Code2,
  Type,
  Hash,
  ToggleLeft,
  List,
  FileJson,
  Calendar,
  Link,
  AlertCircle,
  Check,
  X,
  Edit2,
  Grip
} from 'lucide-react';

interface SchemaField {
  id: string;
  name: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array' | 'date' | 'url' | 'file';
  required: boolean;
  description: string;
  default?: any;
  validation?: {
    pattern?: string;
    min?: number;
    max?: number;
    minLength?: number;
    maxLength?: number;
    enum?: string[];
    format?: string;
  };
  children?: SchemaField[];
}

interface SchemaDesignerProps {
  schema: SchemaField[];
  onChange: (schema: SchemaField[]) => void;
  type: 'input' | 'output';
}

const FIELD_TYPES = [
  { value: 'string', label: 'String', icon: Type, color: 'text-green-400' },
  { value: 'number', label: 'Number', icon: Hash, color: 'text-blue-400' },
  { value: 'boolean', label: 'Boolean', icon: ToggleLeft, color: 'text-purple-400' },
  { value: 'array', label: 'Array', icon: List, color: 'text-yellow-400' },
  { value: 'object', label: 'Object', icon: FileJson, color: 'text-orange-400' },
  { value: 'date', label: 'Date', icon: Calendar, color: 'text-pink-400' },
  { value: 'url', label: 'URL', icon: Link, color: 'text-cyan-400' },
  { value: 'file', label: 'File', icon: FileJson, color: 'text-gray-400' }
];

export default function SchemaDesigner({ schema, onChange, type }: SchemaDesignerProps) {
  const [expandedFields, setExpandedFields] = useState<Set<string>>(new Set());
  const [editingField, setEditingField] = useState<string | null>(null);
  const [draggedField, setDraggedField] = useState<string | null>(null);
  const [jsonView, setJsonView] = useState(false);
  const [jsonError, setJsonError] = useState<string | null>(null);

  const addField = (parentId?: string) => {
    const newField: SchemaField = {
      id: `field_${Date.now()}`,
      name: 'newField',
      type: 'string',
      required: false,
      description: ''
    };

    if (parentId) {
      const updateFields = (fields: SchemaField[]): SchemaField[] => {
        return fields.map(field => {
          if (field.id === parentId) {
            return {
              ...field,
              children: [...(field.children || []), newField]
            };
          }
          if (field.children) {
            return {
              ...field,
              children: updateFields(field.children)
            };
          }
          return field;
        });
      };
      onChange(updateFields(schema));
    } else {
      onChange([...schema, newField]);
    }
    
    setEditingField(newField.id);
  };

  const updateField = (fieldId: string, updates: Partial<SchemaField>) => {
    const updateFields = (fields: SchemaField[]): SchemaField[] => {
      return fields.map(field => {
        if (field.id === fieldId) {
          return { ...field, ...updates };
        }
        if (field.children) {
          return {
            ...field,
            children: updateFields(field.children)
          };
        }
        return field;
      });
    };
    onChange(updateFields(schema));
  };

  const deleteField = (fieldId: string) => {
    const deleteFromFields = (fields: SchemaField[]): SchemaField[] => {
      return fields
        .filter(field => field.id !== fieldId)
        .map(field => {
          if (field.children) {
            return {
              ...field,
              children: deleteFromFields(field.children)
            };
          }
          return field;
        });
    };
    onChange(deleteFromFields(schema));
  };

  const duplicateField = (field: SchemaField) => {
    const duplicate = {
      ...field,
      id: `field_${Date.now()}`,
      name: `${field.name}_copy`
    };
    onChange([...schema, duplicate]);
  };

  const toggleExpanded = (fieldId: string) => {
    const newExpanded = new Set(expandedFields);
    if (newExpanded.has(fieldId)) {
      newExpanded.delete(fieldId);
    } else {
      newExpanded.add(fieldId);
    }
    setExpandedFields(newExpanded);
  };

  const handleDragStart = (e: React.DragEvent, fieldId: string) => {
    setDraggedField(fieldId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    if (!draggedField) return;

    const draggedIndex = schema.findIndex(f => f.id === draggedField);
    if (draggedIndex === -1) return;

    const newSchema = [...schema];
    const [draggedItem] = newSchema.splice(draggedIndex, 1);
    newSchema.splice(targetIndex, 0, draggedItem);
    
    onChange(newSchema);
    setDraggedField(null);
  };

  const generateJsonSchema = (): string => {
    const convertToJsonSchema = (fields: SchemaField[]): any => {
      const properties: any = {};
      const required: string[] = [];

      fields.forEach(field => {
        const jsonField: any = {
          type: field.type === 'url' || field.type === 'file' ? 'string' : field.type,
          description: field.description
        };

        if (field.default !== undefined) {
          jsonField.default = field.default;
        }

        if (field.validation) {
          Object.assign(jsonField, field.validation);
        }

        if (field.type === 'url') {
          jsonField.format = 'uri';
        } else if (field.type === 'file') {
          jsonField.format = 'binary';
        } else if (field.type === 'date') {
          jsonField.format = 'date-time';
        }

        if (field.type === 'object' && field.children) {
          jsonField.properties = convertToJsonSchema(field.children).properties;
        } else if (field.type === 'array') {
          jsonField.items = field.children ? convertToJsonSchema(field.children) : { type: 'string' };
        }

        properties[field.name] = jsonField;
        
        if (field.required) {
          required.push(field.name);
        }
      });

      return {
        type: 'object',
        properties,
        required: required.length > 0 ? required : undefined
      };
    };

    return JSON.stringify(convertToJsonSchema(schema), null, 2);
  };

  const importJsonSchema = (jsonString: string) => {
    try {
      const jsonSchema = JSON.parse(jsonString);
      // Convert JSON Schema back to our format
      // This is a simplified implementation
      setJsonError(null);
    } catch (error) {
      setJsonError('Invalid JSON schema');
    }
  };

  const getFieldIcon = (fieldType: string) => {
    const type = FIELD_TYPES.find(t => t.value === fieldType);
    return type ? type.icon : Type;
  };

  const getFieldColor = (fieldType: string) => {
    const type = FIELD_TYPES.find(t => t.value === fieldType);
    return type ? type.color : 'text-gray-400';
  };

  const renderField = (field: SchemaField, index: number, level: number = 0): React.ReactNode => {
    const Icon = getFieldIcon(field.type);
    const isExpanded = expandedFields.has(field.id);
    const isEditing = editingField === field.id;
    const hasChildren = field.type === 'object' || field.type === 'array';

    return (
      <div key={field.id} className="mb-2">
        <div
          className="group bg-[#0A0A0A] border border-[#262626] rounded-lg p-3 hover:border-[#3B82F6]/50 transition-all"
          style={{ marginLeft: `${level * 24}px` }}
          draggable={level === 0}
          onDragStart={(e) => handleDragStart(e, field.id)}
          onDragOver={handleDragOver}
          onDrop={(e) => handleDrop(e, index)}
        >
          <div className="flex items-start gap-2">
            {/* Drag Handle */}
            {level === 0 && (
              <div className="p-1 cursor-move opacity-0 group-hover:opacity-100 transition-opacity">
                <Grip className="w-4 h-4 text-gray-500" />
              </div>
            )}

            {/* Expand/Collapse */}
            {hasChildren && (
              <button
                onClick={() => toggleExpanded(field.id)}
                className="p-1 hover:bg-[#141414] rounded"
              >
                {isExpanded ? (
                  <ChevronDown className="w-4 h-4 text-gray-400" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-gray-400" />
                )}
              </button>
            )}

            {/* Field Icon */}
            <div className={`p-1.5 bg-[#141414] rounded ${getFieldColor(field.type)}`}>
              <Icon className="w-4 h-4" />
            </div>

            {/* Field Content */}
            <div className="flex-1">
              {isEditing ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <input
                      type="text"
                      value={field.name}
                      onChange={(e) => updateField(field.id, { name: e.target.value })}
                      className="px-3 py-1 bg-black border border-[#262626] rounded text-white text-sm focus:border-[#3B82F6] focus:outline-none"
                      placeholder="Field name"
                      autoFocus
                    />
                    <select
                      value={field.type}
                      onChange={(e) => updateField(field.id, { type: e.target.value as any })}
                      className="px-3 py-1 bg-black border border-[#262626] rounded text-white text-sm focus:border-[#3B82F6] focus:outline-none"
                    >
                      {FIELD_TYPES.map(type => (
                        <option key={type.value} value={type.value}>{type.label}</option>
                      ))}
                    </select>
                  </div>
                  
                  <input
                    type="text"
                    value={field.description}
                    onChange={(e) => updateField(field.id, { description: e.target.value })}
                    className="w-full px-3 py-1 bg-black border border-[#262626] rounded text-white text-sm focus:border-[#3B82F6] focus:outline-none"
                    placeholder="Description"
                  />

                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={field.required}
                        onChange={(e) => updateField(field.id, { required: e.target.checked })}
                        className="w-4 h-4 text-[#3B82F6] bg-black border-[#262626] rounded focus:ring-[#3B82F6]"
                      />
                      <span className="text-sm text-gray-400">Required</span>
                    </label>

                    {field.type !== 'object' && field.type !== 'array' && (
                      <input
                        type="text"
                        value={field.default || ''}
                        onChange={(e) => updateField(field.id, { default: e.target.value })}
                        className="flex-1 px-3 py-1 bg-black border border-[#262626] rounded text-white text-sm focus:border-[#3B82F6] focus:outline-none"
                        placeholder="Default value"
                      />
                    )}
                  </div>

                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => setEditingField(null)}
                      className="px-3 py-1 bg-[#3B82F6] text-white text-sm rounded hover:bg-[#60A5FA] transition-colors"
                    >
                      Done
                    </button>
                  </div>
                </div>
              ) : (
                <div onClick={() => setEditingField(field.id)} className="cursor-pointer">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-white font-medium">{field.name}</span>
                    {field.required && (
                      <span className="px-1.5 py-0.5 bg-red-500/20 text-red-400 text-xs rounded">
                        Required
                      </span>
                    )}
                    <span className={`text-xs ${getFieldColor(field.type)}`}>
                      {field.type}
                    </span>
                  </div>
                  {field.description && (
                    <p className="text-sm text-gray-400">{field.description}</p>
                  )}
                  {field.default !== undefined && (
                    <p className="text-xs text-gray-500 mt-1">
                      Default: {JSON.stringify(field.default)}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              {hasChildren && (
                <button
                  onClick={() => addField(field.id)}
                  className="p-1 text-gray-400 hover:text-white hover:bg-[#141414] rounded"
                  title="Add child field"
                >
                  <Plus className="w-4 h-4" />
                </button>
              )}
              <button
                onClick={() => duplicateField(field)}
                className="p-1 text-gray-400 hover:text-white hover:bg-[#141414] rounded"
                title="Duplicate"
              >
                <Copy className="w-4 h-4" />
              </button>
              <button
                onClick={() => deleteField(field.id)}
                className="p-1 text-gray-400 hover:text-red-400 hover:bg-[#141414] rounded"
                title="Delete"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Children */}
        {hasChildren && isExpanded && field.children && (
          <div className="mt-2">
            {field.children.map((child, childIndex) => 
              renderField(child, childIndex, level + 1)
            )}
            {field.children.length === 0 && (
              <div 
                className="p-3 border-2 border-dashed border-[#262626] rounded-lg text-center text-gray-500 hover:border-[#3B82F6]/50 hover:text-gray-400 transition-colors cursor-pointer"
                style={{ marginLeft: `${(level + 1) * 24}px` }}
                onClick={() => addField(field.id)}
              >
                <Plus className="w-4 h-4 mx-auto mb-1" />
                <span className="text-xs">Add child field</span>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="border-b border-[#262626] p-4 flex items-center justify-between">
        <h3 className="text-lg font-medium text-white">
          {type === 'input' ? 'Input' : 'Output'} Schema Designer
        </h3>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setJsonView(!jsonView)}
            className={`px-3 py-1.5 border rounded-lg text-sm transition-colors ${
              jsonView
                ? 'bg-[#3B82F6] text-white border-[#3B82F6]'
                : 'border-[#262626] text-gray-400 hover:text-white hover:border-[#404040]'
            }`}
          >
            <Code2 className="w-4 h-4 inline mr-1" />
            JSON
          </button>

          <button
            onClick={() => addField()}
            className="px-3 py-1.5 bg-[#3B82F6] text-white text-sm rounded-lg hover:bg-[#60A5FA] transition-colors flex items-center gap-1"
          >
            <Plus className="w-4 h-4" />
            Add Field
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {jsonView ? (
          <div className="space-y-3">
            {jsonError && (
              <div className="p-3 bg-red-900/20 border border-red-800/50 rounded-lg">
                <p className="text-sm text-red-400">{jsonError}</p>
              </div>
            )}
            <textarea
              value={generateJsonSchema()}
              onChange={(e) => importJsonSchema(e.target.value)}
              className="w-full h-full min-h-[400px] px-4 py-3 bg-[#0A0A0A] border border-[#262626] rounded-lg text-white font-mono text-sm focus:border-[#3B82F6] focus:outline-none focus:ring-1 focus:ring-[#3B82F6]/50"
              placeholder="JSON Schema"
            />
          </div>
        ) : (
          <>
            {schema.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full">
                <div className="p-4 bg-[#0A0A0A] border border-[#262626] rounded-full mb-4">
                  <FileJson className="w-8 h-8 text-gray-600" />
                </div>
                <h3 className="text-lg font-medium text-white mb-2">No Fields Defined</h3>
                <p className="text-sm text-gray-400 mb-4">
                  Start by adding fields to define your {type} schema
                </p>
                <button
                  onClick={() => addField()}
                  className="px-4 py-2 bg-[#3B82F6] text-white rounded-lg hover:bg-[#60A5FA] transition-colors flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Add First Field
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {schema.map((field, index) => renderField(field, index))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Tips */}
      {!jsonView && schema.length > 0 && (
        <div className="border-t border-[#262626] p-3 bg-[#0A0A0A]">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-blue-400 mt-0.5" />
            <div className="text-xs text-gray-400">
              <p>Tips: Click on a field to edit it. Drag fields to reorder. Use Object or Array types to create nested structures.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}