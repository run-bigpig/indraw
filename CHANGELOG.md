# Changelog

This document records all important updates and changes to Indraw Editor.

## [1.1.1] - 2025-12-10

### ✨ New Features

#### Image Gallery
- **Image Gallery Feature**: Added image gallery functionality for managing and reusing exported images
  - Added gallery button (Images icon) in toolbar, positioned below upload button
  - Automatically reads all image files from export directory (supports PNG, JPG, JPEG, WebP, GIF, BMP, SVG formats)
  - Image list sorted by modification time (newest first)
  - Displays image thumbnails, filename, size, and modification time
  - Supports refreshing image list
  - Hover to show action buttons (Preview, Import)
  - Click "Preview" button to view enlarged image
  - Click "Import" button to import image to current canvas
  - Can directly import from preview modal
  - Full internationalization support (Chinese/English)

#### Backend API Enhancements
- **File Service Extensions**: Added image file management APIs
  - `ListImagesInDirectory`: Lists all image files in specified directory
  - `ReadImageFile`: Reads image file and returns base64 encoded data
  - Supports multiple image format recognition and MIME type handling

### 🔧 Improvements

#### Performance Optimization
- **Gallery Loading Optimization**: Optimized gallery modal loading performance
  - Modal displays immediately, image list loads asynchronously to avoid lag
  - Lazy loading of image previews, loads thumbnails on demand
  - Preloads previews of first 10 images for better user experience

#### User Experience Improvements
- **Interaction Optimization**: Improved gallery interaction experience
  - Removed card click import, only buttons trigger import to avoid accidental operations
  - Action buttons appear on hover for clearer interface
  - Preview modal supports full-screen viewing of large images
  - Optimized button styles and layout

### 🐛 Bug Fixes

- **Fixed Duplicate Import Issue**: Fixed issue where clicking import button triggered import twice
  - Added event propagation blocking to ensure button clicks don't trigger parent element events
- **Fixed Dependency Loop Issue**: Fixed infinite update loop in gallery component
  - Optimized useEffect dependencies to avoid unnecessary re-renders
  - Refactored loading logic to eliminate dependency cycles

---

## [1.0.4] - 2025-12-10

### 🐛 Bug Fixes

#### Update Service
- **Fixed Git Command Execution Issue**: Resolved issue where update check service was calling git commands, causing terminal window to flash briefly
  - Switched to token-free mode for GitHub API access
  - Removed dependency on gitconfig library that was executing git commands
  - Improved update service initialization to avoid external command execution
  - Better error handling when update service initialization fails

### 🔧 Improvements

#### User Interface
- **Enhanced Release Notes Display**: Improved update log display in settings panel
  - Integrated react-markdown library for full Markdown support
  - Added fixed height (200px) with scrollable content for release notes
  - Enhanced Markdown rendering with custom styled components
  - Support for all standard Markdown features (headers, lists, code blocks, links, etc.)
  - Better visual presentation with theme-consistent styling

---

## [1.0.3] - 2025-12-09

### ✨ New Features

#### Update & Version Management
- **Update Check Service**: Integrated application update checking functionality
  - Automatic new version detection from GitHub Releases
  - Version information display in settings panel
  - Update notification and download support
  - Localization support for update-related messages

#### AI Service Enhancements
- **Service Availability Check**: Implemented AI provider service availability checking
  - Real-time status checking for Gemini, OpenAI, and Cloud providers
  - Better error messages and user feedback
  - Availability status display in settings panel

#### Export Functionality
- **Export Options Modal**: Added comprehensive export options dialog
  - Custom export format selection (PNG, JPG, etc.)
  - Quality and resolution settings
  - Default export directory configuration (Pictures folder)
  - Enhanced image export functionality with more options

#### File Service & Autosave
- **Event-Driven Autosave**: Implemented event-based autosave mechanism
  - Asynchronous save operations with event listeners
  - Optimized save performance, reducing unnecessary operations
  - Real-time save status feedback
  - Improved user experience by avoiding lag from frequent saves
- **Save Request Merging**: Optimized save operations with request merging
  - Queue mechanism to handle multiple save requests efficiently
  - Direct JSON string writing to avoid unnecessary serialization
  - Change detection to skip saves when data hasn't changed
- **Model Download Progress**: Added progress tracking for model downloads
  - Real-time display of download progress
  - Event-driven download notifications
  - Better download status feedback

#### User Interface
- **Enhanced Confirmation Dialogs**: Improved confirmation dialog functionality
  - Added "Discard Changes" option for unsaved changes
  - Enhanced localization support (Chinese and English)
  - Better user experience when closing settings with unsaved changes

---

## [1.0.2] - 2025-12-08

### ✨ New Features

#### AI Service Enhancements
- **Cloud Authentication Token Support**: Added cloud authentication token support
  - Encrypted token storage in settings
  - Token-based authentication for cloud AI services
  - Enhanced security and flexibility

#### Drawing Tools
- **Healing Brush Mode**: Introduced healing brush tool for image repair
  - OpenCV-based image healing functionality
  - Smart image repair capabilities
  - Integration with drawing tools

### 🔧 Improvements

- **Save Performance**: Further optimized file save operations
  - Request merging mechanism
  - Improved save queue handling
  - Reduced resource usage

---

## [1.0.1] - 2025-12-05

### ✨ New Features

#### AI Provider Extensions
- **CloudProvider Implementation**: Added CloudProvider AI service provider
  - Configurable cloud endpoint URL
  - Support for cloud-based AI services
  - Image generation, editing, and prompt enhancement via cloud API
  - Multi-image editing support

#### OpenAI Feature Enhancements
- **Streaming Support**: Added streaming support for OpenAI models
  - Streaming responses from text models
  - Streaming processing for image models
  - Real-time response handling with third-party relay services
  - Improved response speed and user experience
- **Dual Image Generation Modes**: Enhanced OpenAI provider with dual modes
  - Image API mode (DALL-E, GPT Image 1)
  - Chat mode (multimodal models)
  - User-selectable image generation mode
  - Flexible API endpoint configuration

#### Canvas Performance
- **Drawing Performance Optimization**: Optimized canvas drawing performance
  - Direct Konva node manipulation for brush operations
  - Improved drawing smoothness
  - Optimized tool handling logic
  - Reduced rendering latency
  - Smart extraction with Canny edge detection
  - Morphological operations for better image processing

### 🔧 Improvements

- **Dependency Management**: Cleaned up unused package files
- **Dependency Updates**: Updated project dependencies to latest versions
- **Image Processing**: Enhanced smart extraction with caching mechanisms
- **Real-time Preview**: Added debounced preview for image slicing

---

## [1.0.0] - 2025-12-04

### 🎉 First Official Release

This is the first official release of Indraw Editor, featuring a comprehensive AI-powered image editing platform.

### ✨ Core Features

#### AI Capabilities
- **Multiple AI Providers**: Support for Google Gemini and OpenAI
  - Provider-based architecture for easy extension
  - Configurable API keys and endpoints
  - Service availability checking
- **AI Image Generation**: Generate images from text prompts
  - Support for reference images
  - Sketch image support for style transfer
  - Prompt enhancement capabilities
- **AI Image Editing**: Edit images with AI assistance
  - Image transformation with prompts
  - Multi-image blending with custom styles
  - Background removal using RMBG-1.4 model
- **Prompt Management**: Comprehensive prompt library system
  - Remote prompt library fetching from JSON
  - Search and category filtering
  - Style generation and sketch restoration prompts
  - Quick prompt application support

#### Canvas & Drawing Tools
- **Advanced Canvas System**: Professional-grade canvas with Konva
  - High-performance rendering with direct node manipulation
  - Real-time drawing with requestAnimationFrame
  - Optimized brush and eraser tools
  - Dedicated drawing layer for smooth performance
- **Shape Drawing Tools**: Comprehensive shape creation capabilities
  - Polygon, star, rounded rectangle, ellipse shapes
  - Arrow, wedge, ring, and arc shapes
  - Shape properties management
  - Gradient and style customization
- **Drawing Modes**: Multiple drawing modes
  - Normal brush mode
  - AI-assisted brush mode
  - Healing brush mode (OpenCV-based)
  - Eraser tool with transparency support

#### Layer Management
- **Professional Layer System**: Full-featured layer management
  - Multiple layer types (image, text, shape, brush, group)
  - Layer grouping and ungrouping
  - Dynamic layer naming based on type and context
  - Layer visibility and opacity controls
  - Layer reordering with drag-and-drop
- **History System**: Complete undo/redo functionality
  - History panel with operation descriptions
  - Timestamp tracking for all operations
  - History navigation capabilities
  - Optimized history management with idle callbacks

#### Text & Typography
- **Text Editing**: Rich text editing capabilities
  - Font family selection
  - Font size, color, and style customization
  - Text alignment options
  - Dynamic text layer properties

#### Image Processing
- **Image Operations**: Comprehensive image manipulation
  - Image cropping with modal interface
  - Batch image slicing functionality
  - Image composition and layout
  - Smart extraction with edge detection
  - Background removal with RMBG model
- **Model Management**: AI model file management
  - HTTP-based model file server
  - Model download and status checking
  - Transformers.js integration with OpenCV fallback
  - Model configuration in settings

#### File Management
- **Project System**: Complete project management
  - Save and load project files
  - Event-driven autosave mechanism
  - Project path management
  - Temporary project support
- **Export Functionality**: Multiple export options
  - Image export in various formats
  - Custom quality and resolution settings
  - Default export directory configuration
- **File Operations**: Enhanced file handling
  - Drag-and-drop image upload
  - File type validation
  - Visual feedback during operations
  - Automatic canvas fitting for loaded images

#### User Interface
- **Modern Design**: Clean and intuitive interface
  - Dark theme with modern aesthetics
  - Responsive layout with panels
  - Toolbar with tool selection
  - Properties panel for layer editing
  - Settings panel for configuration
- **Internationalization**: Full i18n support
  - Chinese (Simplified) and English interfaces
  - Language switcher component
  - Comprehensive localization coverage
- **User Experience**: Enhanced usability
  - Confirmation dialogs with discard option
  - Full-screen loading overlays
  - Progress indicators for operations
  - Keyboard shortcuts support

#### CI/CD & Build System
- **Automated Releases**: GitHub Actions workflow
  - Multi-architecture builds (Windows, Linux, macOS)
  - Automated build and release on version tags
  - Cross-platform artifact handling
  - Architecture-specific builds (amd64, arm64 for macOS)
- **Build Configuration**: Optimized build setup
  - Vite configuration for fast builds
  - Proper .gitignore for build artifacts
  - Windows application icon
  - Platform-specific build configurations

### 🔧 Performance Optimizations

- **Canvas Performance**: Optimized drawing with Konva native API
  - Direct node manipulation for brush/eraser tools
  - requestAnimationFrame for smooth updates
  - requestIdleCallback for non-blocking operations
  - React.memo and useMemo optimizations
  - Throttled callbacks for performance control
- **Save Operations**: Optimized file operations
  - Debounced auto-save to reduce I/O overhead
  - Request merging for multiple saves
  - Change detection to skip unnecessary saves
  - Queue mechanism for efficient save handling
- **Image Processing**: Enhanced image operations
  - Parallel image loading
  - Caching mechanisms for background removal
  - Smart extraction with optimized algorithms
  - Debounced preview for image slicing

### 🔧 Code Quality

- **Architecture**: Well-structured codebase
  - Provider-based AI service architecture
  - Centralized type definitions
  - Modular component structure
  - Clean separation of concerns
- **Refactoring**: Code improvements
  - AI provider interface restructuring
  - Settings context refactoring for hooks
  - Removed debug logs and unnecessary code
  - Improved error handling

### 🐛 Bug Fixes

- **CI Configuration**: Fixed Ubuntu compatibility
  - pkg-config alias for webkit2gtk-4.0 compatibility
  - Updated webkit2gtk package name
- **Type Definitions**: Fixed comment formatting
- **Localization**: Improved clarity of messages

---

## Update Notes

### Version Number Rules
- **Major Version**: Major feature updates or architectural changes
- **Minor Version**: New features or significant improvements
- **Patch Version**: Bug fixes and minor optimizations

### Update Type Descriptions
- ✨ **New Features**: Newly added feature capabilities
- 🔧 **Improvements**: Performance optimizations, user experience improvements, etc.
- 🐛 **Bug Fixes**: Bug fixes and issue resolutions
- 📝 **Documentation Updates**: Documentation and comment updates
- 🔄 **Refactoring**: Code refactoring and architectural adjustments

---

**Note**: This document will be continuously updated to record all important changes. It is recommended to check regularly to stay informed about the latest features and improvements.
