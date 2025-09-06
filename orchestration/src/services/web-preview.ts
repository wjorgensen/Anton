import express, { Application } from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { Server } from 'socket.io';
import * as chokidar from 'chokidar';
import * as path from 'path';
import * as http from 'http';
import * as fs from 'fs/promises';

interface PreviewServer {
  app: Application;
  server: http.Server;
  io: Server;
  watcher: chokidar.FSWatcher;
  port: number;
}

export class WebPreviewService {
  private servers = new Map<string, PreviewServer>();
  private basePort = 4000;
  
  constructor() {}

  /**
   * Start a preview server for a specific node execution
   */
  async startPreviewServer(nodeId: string, executionId: string): Promise<string> {
    // Check if server already exists for this node
    if (this.servers.has(nodeId)) {
      const existing = this.servers.get(nodeId)!;
      return `http://localhost:${existing.port}`;
    }

    const projectPath = path.join(process.cwd(), 'projects', executionId, nodeId);
    
    // Ensure project directory exists
    try {
      await fs.access(projectPath);
    } catch {
      await fs.mkdir(projectPath, { recursive: true });
    }

    // Calculate unique port based on nodeId
    const port = this.basePort + parseInt(nodeId.slice(-4), 16) % 1000;
    
    const app = express();
    
    // Serve static files from dist or public directories
    const staticPaths = [
      path.join(projectPath, 'dist'),
      path.join(projectPath, 'public'),
      path.join(projectPath, 'build'),
      projectPath // Fallback to project root
    ];
    
    for (const staticPath of staticPaths) {
      try {
        await fs.access(staticPath);
        app.use(express.static(staticPath));
        console.log(`Serving static files from: ${staticPath}`);
        break;
      } catch {
        // Directory doesn't exist, try next
      }
    }
    
    // Proxy API calls to backend
    app.use('/api', createProxyMiddleware({
      target: 'http://localhost:3002',
      changeOrigin: true,
      pathRewrite: {
        '^/api': '/api'
      },
      on: {
        error: (err: Error) => {
          console.error('Proxy error:', err);
        }
      }
    }));
    
    // Create HTTP server
    const server = http.createServer(app);
    
    // Setup Socket.IO for hot reload
    const io = new Server(server, {
      cors: {
        origin: '*',
        methods: ['GET', 'POST']
      }
    });
    
    // Watch for file changes
    const watcher = chokidar.watch(projectPath, {
      ignored: [
        /node_modules/,
        /\.git/,
        /\.cache/,
        /\.next/,
        /\.nuxt/,
        /dist/,
        /build/
      ],
      persistent: true,
      ignoreInitial: true,
      awaitWriteFinish: {
        stabilityThreshold: 300,
        pollInterval: 100
      }
    });
    
    // Handle file changes
    watcher.on('change', (filePath) => {
      console.log(`File changed: ${filePath}`);
      io.emit('reload', {
        file: path.relative(projectPath, filePath),
        timestamp: new Date().toISOString()
      });
    });
    
    watcher.on('add', (filePath) => {
      console.log(`File added: ${filePath}`);
      io.emit('reload', {
        file: path.relative(projectPath, filePath),
        timestamp: new Date().toISOString()
      });
    });
    
    watcher.on('unlink', (filePath) => {
      console.log(`File removed: ${filePath}`);
      io.emit('reload', {
        file: path.relative(projectPath, filePath),
        timestamp: new Date().toISOString()
      });
    });
    
    // Handle Socket.IO connections
    io.on('connection', (socket) => {
      console.log(`Client connected for preview ${nodeId}`);
      
      socket.on('disconnect', () => {
        console.log(`Client disconnected for preview ${nodeId}`);
      });
      
      // Send initial connection confirmation
      socket.emit('connected', {
        nodeId,
        executionId,
        projectPath
      });
    });
    
    // Inject hot reload script into HTML responses
    app.use((_req, res, next) => {
      const originalSend = res.send;
      res.send = function(data: any) {
        if (typeof data === 'string' && data.includes('</body>')) {
          const hotReloadScript = `
            <script src="/socket.io/socket.io.js"></script>
            <script>
              (function() {
                const socket = io('http://localhost:${port}');
                
                socket.on('reload', function(data) {
                  console.log('Reloading due to change in:', data.file);
                  window.location.reload();
                });
                
                socket.on('connect', function() {
                  console.log('Hot reload connected');
                });
                
                socket.on('disconnect', function() {
                  console.log('Hot reload disconnected');
                });
              })();
            </script>
          `;
          data = data.replace('</body>', hotReloadScript + '</body>');
        }
        return originalSend.call(this, data);
      };
      next();
    });
    
    // Start the server
    await new Promise<void>((resolve, reject) => {
      server.listen(port, () => {
        console.log(`Preview server started for node ${nodeId} on port ${port}`);
        resolve();
      }).on('error', reject);
    });
    
    // Store server reference
    this.servers.set(nodeId, {
      app,
      server,
      io,
      watcher,
      port
    });
    
    return `http://localhost:${port}`;
  }

  /**
   * Stop a preview server
   */
  async stopPreviewServer(nodeId: string): Promise<void> {
    const server = this.servers.get(nodeId);
    if (!server) {
      console.warn(`No preview server found for node ${nodeId}`);
      return;
    }
    
    // Close watcher
    await server.watcher.close();
    
    // Close Socket.IO
    server.io.close();
    
    // Close HTTP server
    await new Promise<void>((resolve) => {
      server.server.close(() => {
        console.log(`Preview server stopped for node ${nodeId}`);
        resolve();
      });
    });
    
    // Remove from map
    this.servers.delete(nodeId);
  }

  /**
   * Stop all preview servers
   */
  async stopAllServers(): Promise<void> {
    const stopPromises = Array.from(this.servers.keys()).map(nodeId =>
      this.stopPreviewServer(nodeId)
    );
    await Promise.all(stopPromises);
  }

  /**
   * Get preview URL for a node
   */
  getPreviewUrl(nodeId: string): string | null {
    const server = this.servers.get(nodeId);
    return server ? `http://localhost:${server.port}` : null;
  }

  /**
   * Get all active preview servers
   */
  getActiveServers(): Map<string, { port: number; url: string }> {
    const active = new Map<string, { port: number; url: string }>();
    
    this.servers.forEach((server, nodeId) => {
      active.set(nodeId, {
        port: server.port,
        url: `http://localhost:${server.port}`
      });
    });
    
    return active;
  }

  /**
   * Emit custom event to a specific preview
   */
  emitToPreview(nodeId: string, event: string, data: any): void {
    const server = this.servers.get(nodeId);
    if (server) {
      server.io.emit(event, data);
    }
  }
}