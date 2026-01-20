/**
 * ServerList Component
 * 
 * Displays all running/stopped servers.
 */

import { useApp } from '../../store';
import './ServerList.css';

export function ServerList() {
    const { servers, stopServer } = useApp();

    const runningServers = servers.filter((s) => s.status === 'running');

    if (runningServers.length === 0) {
        return null;
    }

    return (
        <div className="server-list card">
            <h2 className="server-list__title">
                Running Servers
                <span className="badge badge-success" style={{ marginLeft: '0.5rem', fontSize: '0.8rem' }}>{runningServers.length}</span>
            </h2>

            <div className="server-list__items">
                {runningServers.map((server) => (
                    <div key={server.id} className="server-card">
                        <div className="server-card__info">
                            <div className="server-card__header">
                                <span className="server-card__repo">{server.repo_name}</span>
                                <code className="server-card__hash">{server.short_hash}</code>
                            </div>
                            <div className="server-card__url">
                                <a href={server.url} target="_blank" rel="noopener noreferrer">
                                    {server.url}
                                </a>
                            </div>
                        </div>

                        <div className="server-card__actions">
                            <button
                                className="btn btn-secondary btn-sm"
                                onClick={() => window.open(server.url, '_blank')}
                            >
                                Open
                            </button>
                            <button
                                className="btn btn-danger btn-sm"
                                onClick={() => stopServer(server.id)}
                            >
                                Stop
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
