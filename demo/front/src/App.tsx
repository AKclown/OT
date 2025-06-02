import React, { useState } from 'react';
import { Editor } from './Editor';

const App: React.FC = () => {
  const [docId, setDocId] = useState('');
  const [showEditor, setShowEditor] = useState(false);

  return (
    <div className="app">
      <h1>协同文本编辑器</h1>
      {showEditor ? (
        <Editor docId={docId} />
      ) : (
        <div>
          <input
            type="text"
            placeholder="输入文档id"
            value={docId}
            onChange={(e) => setDocId(e.target.value)}
          />
          <button onClick={() => setShowEditor(true)}>打开文档</button>
        </div>
      )}
    </div>
  );
};

export default App;