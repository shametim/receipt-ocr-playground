import { useState } from 'react'
import './App.css'

interface ReceiptAnalysis {
  store_name?: string;
  date?: string;
  total?: number;
  invoice_number?: string;
  line_items: Array<{
    name: string;
    quantity?: number;
    price: number;
    friendlyName?: string;
  }>;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(amount);
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return 'Unknown Date';
  try {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  } catch {
    return dateStr;
  }
}

function ReceiptView({ data, title }: { data: ReceiptAnalysis | null, title: string }) {
  if (!data) {
    return (
      <div className="result-box">
        <h2>{title}</h2>
        <p>No results yet</p>
      </div>
    );
  }

  return (
    <div className="result-box">
      <h2>
        {title}
        {data.total && <span className="total">{formatCurrency(data.total)}</span>}
      </h2>
      
      <div className="receipt-details">
        {data.store_name && <p><strong>Store:</strong> {data.store_name}</p>}
        {data.date && <p><strong>Date:</strong> {formatDate(data.date)}</p>}
        {data.invoice_number && <p><strong>Invoice:</strong> {data.invoice_number}</p>}
      </div>

      <ul className="line-items">
        {data.line_items.map((item, index) => (
          <li key={index} className="line-item">
            <span className="line-item-name">
              {item.friendlyName || item.name}
            </span>
            {item.quantity && (
              <span className="line-item-quantity">
                × {item.quantity}
              </span>
            )}
            <span className="line-item-price">
              {formatCurrency(item.price)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function App() {
  const [image, setImage] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [model, setModel] = useState<string>('both');
  const [loading, setLoading] = useState(false);
  const [claudeResult, setClaudeResult] = useState<ReceiptAnalysis | null>(null);
  const [grokResult, setGrokResult] = useState<ReceiptAnalysis | null>(null);
  const [mistralResult, setMistralResult] = useState<ReceiptAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImage(file);
      setError(null);
      // Create preview URL
      const url = URL.createObjectURL(file);
      setPreview(url);
    }
  };

  const analyzeImage = async () => {
    if (!image) return;

    setLoading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('image', image);
      formData.append('model', model);

      const headers = {
        'Device-ID': 'playground-test-device',
      };

      const response = await fetch('http://localhost:3010/analyze-receipt', {
        method: 'POST',
        headers,
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Analysis failed: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (model === 'both') {
        setClaudeResult(data.claude);
        setGrokResult(data.grok);
        setMistralResult(data.mistral);
      } else if (model === 'claude') {
        setClaudeResult(data);
        setGrokResult(null);
        setMistralResult(null);
      } else if (model === 'grok') {
        setGrokResult(data);
        setClaudeResult(null);
        setMistralResult(null);
      } else {
        setMistralResult(data);
        setClaudeResult(null);
        setGrokResult(null);
      }
    } catch (error) {
      console.error('Error analyzing image:', error);
      setError(error instanceof Error ? error.message : 'Failed to analyze receipt');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container">
      <h1>Receipt Analysis Playground</h1>
      
      <div className="upload-section">
        <div className="controls">
          <input
            type="file"
            onChange={handleImageChange}
            accept="image/*"
            className="file-input"
          />
          
          <select 
            value={model} 
            onChange={(e) => setModel(e.target.value)}
            className="model-select"
          >
            <option value="both">All Models</option>
            <option value="claude">Claude Only</option>
            <option value="grok">Grok Only</option>
            <option value="mistral">Mistral Only</option>
          </select>

          <button
            onClick={analyzeImage}
            disabled={!image || loading}
            className="analyze-button"
          >
            {loading ? 'Analyzing...' : 'Analyze Receipt'}
          </button>
        </div>

        {preview && (
          <img src={preview} alt="Receipt preview" className="preview" />
        )}

        {error && (
          <div className="error-message">
            {error}
          </div>
        )}
      </div>

      <div className="results-container">
        {(claudeResult || model === 'both' || model === 'claude') && (
          <ReceiptView data={claudeResult} title="Claude Analysis" />
        )}
        
        {(grokResult || model === 'both' || model === 'grok') && (
          <ReceiptView data={grokResult} title="Grok Analysis" />
        )}

        {(mistralResult || model === 'both' || model === 'mistral') && (
          <ReceiptView data={mistralResult} title="Mistral Analysis" />
        )}
      </div>
    </div>
  )
}

export default App
