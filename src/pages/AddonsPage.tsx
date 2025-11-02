import React from 'react';
import './AddonsPage.css';

const AddonsPage: React.FC = () => {
  return (
    <div className="addons-page">
      <div className="page-header">
        <h1>Addons</h1>
        <button className="install-addon-btn">+ Install Addon</button>
      </div>
      <div className="addons-content">
        <div className="addons-grid">
          <div className="addon-card">
            <div className="addon-icon">🤖</div>
            <h3>AI Assistant</h3>
            <p>Enhance your notes with AI-powered suggestions and completions</p>
            <div className="addon-footer">
              <span className="addon-status installed">Installed</span>
              <button className="addon-btn">Configure</button>
            </div>
          </div>

          <div className="addon-card">
            <div className="addon-icon">📊</div>
            <h3>Charts & Diagrams</h3>
            <p>Create beautiful charts and diagrams using Mermaid syntax</p>
            <div className="addon-footer">
              <span className="addon-status">Not Installed</span>
              <button className="addon-btn primary">Install</button>
            </div>
          </div>

          <div className="addon-card">
            <div className="addon-icon">🔗</div>
            <h3>Link Preview</h3>
            <p>Beautiful previews for external links in your notes</p>
            <div className="addon-footer">
              <span className="addon-status">Not Installed</span>
              <button className="addon-btn primary">Install</button>
            </div>
          </div>

          <div className="addon-card">
            <div className="addon-icon">📝</div>
            <h3>Templates</h3>
            <p>Quick note templates for common use cases</p>
            <div className="addon-footer">
              <span className="addon-status">Not Installed</span>
              <button className="addon-btn primary">Install</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AddonsPage;
