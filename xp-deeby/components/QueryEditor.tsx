/**
 * Query Editor Component
 * 
 * An expandable, resizable text input for SQL queries.
 * Auto-expands to fit content up to 5 lines, then scrolls.
 * Allows drag-to-resize for more space.
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
    View,
    TextInput,
    StyleSheet,
    TouchableOpacity,
    Text,
    Platform,
} from 'react-native';

export interface QueryEditorProps {
    value: string;
    onChangeText: (text: string) => void;
    onExecute: () => void;
    placeholder?: string;
    disabled?: boolean;
    loading?: boolean;
    showExpandButton?: boolean;
    onExpand?: () => void;
    showCollapseButton?: boolean;
    onCollapse?: () => void;
}

export default function QueryEditor({
    value,
    onChangeText,
    onExecute,
    placeholder = 'Enter SQL query...',
    disabled = false,
    loading = false,
    showExpandButton = false,
    onExpand,
    showCollapseButton = false,
    onCollapse,
}: QueryEditorProps) {
    const [height, setHeight] = useState(40); // Initial height for single line
    const [isResizing, setIsResizing] = useState(false);
    const [resizeStartY, setResizeStartY] = useState(0);
    const [resizeStartHeight, setResizeStartHeight] = useState(40);
    const inputRef = useRef<TextInput>(null);
    const minHeight = 40;
    const maxAutoHeight = 120; // ~5 lines at 24px line height
    const maxManualHeight = 400;

    // Calculate auto height based on content
    const calculateAutoHeight = useCallback((text: string): number => {
        const lineCount = (text.match(/\n/g) || []).length + 1;
        const lineHeight = 24; // Approximate line height
        const padding = 16; // Top and bottom padding
        const calculatedHeight = lineCount * lineHeight + padding;
        return Math.min(Math.max(calculatedHeight, minHeight), maxAutoHeight);
    }, []);

    // Update height when value changes (auto-expand)
    useEffect(() => {
        if (!isResizing && height < maxAutoHeight) {
            const newHeight = calculateAutoHeight(value);
            setHeight(newHeight);
        }
    }, [value, calculateAutoHeight, isResizing, height]);

    // Handle resize start (web)
    const handleResizeStart = useCallback((e: any) => {
        if (Platform.OS !== 'web') return;
        e.preventDefault();
        e.stopPropagation();
        setIsResizing(true);
        const clientY = e.clientY || e.nativeEvent?.clientY || 0;
        setResizeStartY(clientY);
        setResizeStartHeight(height);
    }, [height]);

    // Handle resize move (web)
    useEffect(() => {
        if (Platform.OS !== 'web' || typeof document === 'undefined') return;

        const handleMouseMove = (e: MouseEvent) => {
            if (!isResizing) return;
            const diff = resizeStartY - e.clientY; // Inverted because we're resizing from bottom
            const newHeight = Math.min(
                Math.max(resizeStartHeight + diff, minHeight),
                maxManualHeight
            );
            setHeight(newHeight);
        };

        const handleMouseUp = () => {
            if (isResizing) {
                setIsResizing(false);
            }
        };

        if (isResizing) {
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
        }

        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isResizing, resizeStartY, resizeStartHeight]);

    // Handle keyboard submit (Enter) and newline (Shift+Enter)
    // Use useEffect to attach event listener directly to DOM element for React Native Web
    useEffect(() => {
        if (Platform.OS !== 'web') return;

        // Try to find the actual input element
        const findInputElement = (): HTMLTextAreaElement | HTMLInputElement | null => {
            if (!inputRef.current) return null;
            
            const inputElement = inputRef.current as any;
            
            // Try different ways to access the DOM node
            let domNode = inputElement._node || 
                         inputElement._nativeNode || 
                         (inputElement.setNativeProps ? inputElement : null);
            
            // If we have a ref, try to find the textarea/input inside it
            if (domNode && typeof domNode.querySelector === 'function') {
                const textarea = domNode.querySelector('textarea') || domNode.querySelector('input');
                if (textarea) return textarea;
            }
            
            // Try direct access
            if (domNode && (domNode.tagName === 'TEXTAREA' || domNode.tagName === 'INPUT')) {
                return domNode;
            }
            
            // Fallback: search by finding the input container
            const container = inputRef.current as any;
            if (container && container._nativeNode) {
                const textarea = container._nativeNode.querySelector?.('textarea') || 
                                container._nativeNode.querySelector?.('input');
                if (textarea) return textarea;
            }
            
            return null;
        };

        // Use a small delay to ensure the DOM is ready
        let cleanup: (() => void) | null = null;
        const timeoutId = setTimeout(() => {
            const inputEl = findInputElement();
            if (!inputEl) return;

            const handleKeyDown = (e: Event) => {
                const keyEvent = e as KeyboardEvent;
                // Enter without Shift: submit query
                if (keyEvent.key === 'Enter' && !keyEvent.shiftKey) {
                    keyEvent.preventDefault();
                    keyEvent.stopPropagation();
                    if (value.trim() && !disabled && !loading) {
                        onExecute();
                    }
                    return;
                }
                // Shift+Enter: allow normal newline (no preventDefault)
                // Cmd/Ctrl + Enter: also submit (for convenience)
                if ((keyEvent.metaKey || keyEvent.ctrlKey) && keyEvent.key === 'Enter') {
                    keyEvent.preventDefault();
                    keyEvent.stopPropagation();
                    if (value.trim() && !disabled && !loading) {
                        onExecute();
                    }
                }
            };

            inputEl.addEventListener('keydown', handleKeyDown, true);

            cleanup = () => {
                inputEl.removeEventListener('keydown', handleKeyDown, true);
            };
        }, 100);

        return () => {
            clearTimeout(timeoutId);
            if (cleanup) cleanup();
        };
    }, [onExecute, value, disabled, loading, inputRef]);

    return (
        <View style={styles.container}>
            {showExpandButton && onExpand && (
                <TouchableOpacity
                    style={styles.expandButton}
                    onPress={onExpand}
                >
                    <Text style={styles.expandButtonIcon}>☰</Text>
                </TouchableOpacity>
            )}
            {showCollapseButton && onCollapse && (
                <TouchableOpacity
                    style={styles.expandButton}
                    onPress={onCollapse}
                >
                    <Text style={styles.expandButtonIcon}>◀</Text>
                </TouchableOpacity>
            )}
            <View style={styles.inputContainer}>
                <TextInput
                    ref={inputRef}
                    style={[
                        styles.input,
                        { height: Math.max(height, minHeight) },
                        disabled && styles.inputDisabled,
                    ]}
                    value={value}
                    onChangeText={onChangeText}
                    placeholder={placeholder}
                    placeholderTextColor="#999"
                    multiline
                    textAlignVertical="top"
                    autoCapitalize="none"
                    autoCorrect={false}
                    spellCheck={false}
                    editable={!disabled}
                    scrollEnabled={height >= maxAutoHeight}
                />
                {Platform.OS === 'web' && (
                    <View
                        style={[
                            styles.resizeHandle,
                            isResizing && styles.resizeHandleActive,
                        ]}
                        onMouseDown={handleResizeStart}
                    />
                )}
            </View>
            <TouchableOpacity
                style={[styles.executeButton, (disabled || !value.trim() || loading) && styles.executeButtonDisabled]}
                onPress={onExecute}
                disabled={disabled || !value.trim() || loading}
            >
                {loading ? (
                    <Text style={styles.executeButtonText}>...</Text>
                ) : (
                    <Text style={styles.executeButtonText}>Run</Text>
                )}
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 8,
        padding: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#e0e0e0',
        backgroundColor: '#fafafa',
    },
    expandButton: {
        padding: 8,
        justifyContent: 'center',
        alignItems: 'center',
        minWidth: 36,
        height: 40,
    },
    expandButtonIcon: {
        fontSize: 18,
        color: '#667eea',
        fontWeight: '600',
    },
    inputContainer: {
        flex: 1,
        position: 'relative',
    },
    input: {
        borderWidth: 1,
        borderColor: '#ddd',
        borderRadius: 6,
        padding: 8,
        fontSize: 14,
        fontFamily: 'monospace',
        backgroundColor: '#fff',
        minHeight: 40,
        maxHeight: 400,
    },
    inputDisabled: {
        backgroundColor: '#f5f5f5',
        opacity: 0.6,
    },
    resizeHandle: {
        position: 'absolute',
        bottom: 0,
        right: 0,
        width: 20,
        height: 8,
        backgroundColor: 'rgba(102, 126, 234, 0.1)',
        borderTopLeftRadius: 4,
        cursor: 'ns-resize',
        zIndex: 10,
    },
    resizeHandleActive: {
        backgroundColor: '#667eea',
        opacity: 0.6,
    },
    executeButton: {
        paddingHorizontal: 20,
        paddingVertical: 10,
        backgroundColor: '#667eea',
        borderRadius: 6,
        minWidth: 80,
        alignItems: 'center',
        justifyContent: 'center',
        height: 40,
    },
    executeButtonDisabled: {
        backgroundColor: '#ccc',
        opacity: 0.6,
    },
    executeButtonText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '600',
    },
});

