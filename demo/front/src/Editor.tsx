import React, { useState, useEffect, useRef } from 'react';
import ContentEditable, { ContentEditableEvent } from 'react-contenteditable';
import { OTClient, Operation } from './OTClient';
import './editor.css'

interface EditorProps {
    docId: string;
}

export const Editor: React.FC<EditorProps> = ({ docId }) => {
    const [content, setContent] = useState('');
    const [isConnected, setIsConnected] = useState(false);
    const otClientRef = useRef<OTClient | null>(null);
    const lastHtmlRef = useRef('');

    useEffect(() => {
        otClientRef.current = new OTClient(docId, (newContent) => {
            setContent(newContent);
            lastHtmlRef.current = newContent;
        });
        setIsConnected(true);

        return () => {
            otClientRef.current?.disconnect();
        };
    }, [docId]);

    const handleChange = (evt: ContentEditableEvent) => {
        const newHtml = evt.target.value;
        const oldHtml = lastHtmlRef.current;

        if (newHtml !== oldHtml) {
            const operations = calculateOperations(oldHtml, newHtml);
            operations.forEach(op => otClientRef.current?.applyLocalOperation(op));

            lastHtmlRef.current = newHtml;
        }

        setContent(newHtml)

    };

    const calculateOperations = (oldText: string, newText: string): Operation[] => {
        const operations: Operation[] = [];
        let i = 0;

        // 找出第一处不同
        while (i < oldText.length && i < newText.length && oldText[i] === newText[i]) {
            i++;
        }

        // $ 处理删除
        if (oldText.length > newText.length) {
            const deleteCount = oldText.length - newText.length;
            operations.push({
                type: 'delete',
                position: i,
                length: deleteCount,
            });
        }
        // $ 处理插入
        else if (newText.length > oldText.length) {
            const insertedText = newText.slice(i, i + (newText.length - oldText.length));
            operations.push({
                type: 'insert',
                position: i,
                text: insertedText,
            });
        }
        // 还有其他操作，例如替换  replace
       

        return operations;
    };

    return (
        <div className="editor-container">
            <div className="status">Status: {isConnected ? '在线' : '断开'}</div>
            <textarea value={content} className="editor" onChange={handleChange}></textarea>
        </div>
    );
};