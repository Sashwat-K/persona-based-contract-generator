# Building IBM Confidential Computing Contract Builder Desktop App

This guide explains how to build the desktop application for production distribution.

## Prerequisites

- **Node.js**: v25.9.0 or higher (latest stable recommended)
- **npm**: v11.12.1 or higher
- **Operating System**: 
  - macOS 10.13+ (for macOS builds)
  - Windows 10+ (for Windows builds)
  - Linux (Ubuntu 18.04+, Fedora, etc. for Linux builds)

## Quick Start

### 1. Install Dependencies

```bash
cd app
npm install
```

### 2. Build for Production

```bash
# Build the React app
npm run build

# Package the Electron app for your current platform
npm run package
```

The packaged application will be in the `app/dist-electron` directory.

## Platform-Specific Builds

### Build for macOS

```bash
npm run build
npm run package -- --mac
```

**Output:**
- `dist-electron/IBM Confidential Computing Contract Builder-1.0.0.dmg` (installer)
- `dist-electron/IBM Confidential Computing Contract Builder-1.0.0-mac.zip` (portable)

**Architectures:**
- Intel (x64)
- Apple Silicon (arm64)

### Build for Windows

```bash
npm run build
npm run package -- --win
```

**Output:**
- `dist-electron/IBM Confidential Computing Contract Builder Setup 1.0.0.exe` (installer)
- `dist-electron/IBM Confidential Computing Contract Builder 1.0.0.exe` (portable)

**Architectures:**
- 64-bit (x64)
- 32-bit (ia32)

### Build for Linux

```bash
npm run build
npm run package -- --linux
```

**Output:**
- `dist-electron/IBM Confidential Computing Contract Builder-1.0.0.AppImage` (universal)
- `dist-electron/ibm-confidential-computing-contract-builder_1.0.0_amd64.deb` (Debian/Ubuntu)
- `dist-electron/ibm-confidential-computing-contract-builder-1.0.0.x86_64.rpm` (Fedora/RHEL)

## Build All Platforms

To build for all platforms (requires appropriate OS):

```bash
npm run build
npm run package -- --mac --win --linux
```

**Note:** Cross-platform building has limitations:
- macOS builds require macOS
- Windows builds can be done on Windows or macOS (with Wine)
- Linux builds can be done on Linux or macOS (with Docker)

## Development Build

For testing the production build locally:

```bash
# Build React app
npm run build

# Run Electron with production build
NODE_ENV=production electron .
```

## Build Configuration

The build is configured in `electron-builder.json`:

- **App ID**: `com.ibm.hpcr.contract-builder`
- **Product Name**: IBM Confidential Computing Contract Builder
- **Version**: Taken from `package.json`
- **Output Directory**: `dist-electron/`

### Customizing the Build

Edit `electron-builder.json` to customize:
- Application icon
- Installer options
- File associations
- Auto-update settings
- Code signing (for distribution)

## Icons

Place your application icons in the `app/build/` directory:

- **macOS**: `icon.icns` (512x512 or higher)
- **Windows**: `icon.ico` (256x256 with multiple sizes)
- **Linux**: `icon.png` (512x512 or higher)

## Code Signing (Optional)

### macOS

1. Get an Apple Developer certificate
2. Set environment variables:
   ```bash
   export CSC_LINK=/path/to/certificate.p12
   export CSC_KEY_PASSWORD=your_password
   ```
3. Build with signing:
   ```bash
   npm run package -- --mac
   ```

### Windows

1. Get a code signing certificate
2. Set environment variables:
   ```bash
   export CSC_LINK=/path/to/certificate.pfx
   export CSC_KEY_PASSWORD=your_password
   ```
3. Build with signing:
   ```bash
   npm run package -- --win
   ```

## Troubleshooting

### Build Fails

1. **Clear cache and rebuild:**
   ```bash
   rm -rf node_modules dist dist-electron
   npm install
   npm run build
   npm run package
   ```

2. **Check Node.js version:**
   ```bash
   node --version  # Should be v25.9.0+
   ```

3. **Check disk space:**
   Ensure you have at least 2GB free space

### App Won't Start

1. **Check console for errors:**
   - macOS: Open Console.app
   - Windows: Check Event Viewer
   - Linux: Run from terminal to see output

2. **Verify all dependencies are included:**
   ```bash
   npm run build
   ```

### Icons Not Showing

1. Ensure icons are in `app/build/` directory
2. Icons must be in correct format for each platform
3. Rebuild after adding icons

## Distribution

### macOS

- **DMG**: Drag-and-drop installer
- **ZIP**: Extract and run

**Note:** Users may need to allow the app in System Preferences > Security & Privacy

### Windows

- **NSIS Installer**: Standard Windows installer
- **Portable**: No installation required

**Note:** Windows Defender may show a warning for unsigned apps

### Linux

- **AppImage**: Universal, no installation required
  ```bash
  chmod +x IBM\ Confidential\ Computing\ Contract\ Builder-1.0.0.AppImage
  ./IBM\ Confidential\ Computing\ Contract\ Builder-1.0.0.AppImage
  ```
- **DEB**: For Debian/Ubuntu
  ```bash
  sudo dpkg -i ibm-confidential-computing-contract-builder_1.0.0_amd64.deb
  ```
- **RPM**: For Fedora/RHEL
  ```bash
  sudo rpm -i ibm-confidential-computing-contract-builder-1.0.0.x86_64.rpm
  ```

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Build Desktop App

on:
  push:
    tags:
      - 'v*'

jobs:
  build:
    runs-on: ${{ matrix.os }}
    strategy:
      matrix:
        os: [macos-latest, windows-latest, ubuntu-latest]
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: |
          cd app
          npm install
      
      - name: Build
        run: |
          cd app
          npm run build
          npm run package
      
      - name: Upload artifacts
        uses: actions/upload-artifact@v3
        with:
          name: ${{ matrix.os }}-build
          path: app/dist-electron/*
```

## File Size Optimization

To reduce the final package size:

1. **Remove dev dependencies from production:**
   Already configured in `electron-builder.json`

2. **Compress assets:**
   Images and icons should be optimized

3. **Use asar archive:**
   Enabled by default in electron-builder

## Security Considerations

1. **Code Signing**: Recommended for distribution
2. **Auto-Updates**: Configure electron-updater for secure updates
3. **CSP**: Content Security Policy is configured in main process
4. **Context Isolation**: Enabled in BrowserWindow configuration

## Support

For issues or questions:
- GitHub Issues: https://github.com/Sashwat-K/persona-based-contract-generator/issues
- Documentation: See `Design/3-desktop-app-design.md`

## License

Apache-2.0 - See LICENSE file for details
