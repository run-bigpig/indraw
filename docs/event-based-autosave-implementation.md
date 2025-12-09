# 基于事件的自动保存功能实现

## 📋 概述

已成功实现基于 Wails 事件系统的自动保存功能，实现了完全异步的保存机制，消除了页面卡顿，同时确保了保存的顺序性。

## ✅ 实现的功能

### 1. 后端实现（Go）

**文件**: `core/service/file_service.go`

#### 主要改动：

1. **事件监听器注册** (`registerEventHandlers`)
   - 监听 `autosave-request` 事件：处理自动保存请求
   - 监听 `project-save-request` 事件：处理项目保存请求
   - 事件处理函数将请求加入现有队列，确保顺序性

2. **队列机制保持顺序性**
   - 所有保存请求（包括事件驱动的）都通过同一个队列处理
   - 使用 `pendingSaveMu` 互斥锁保护队列操作
   - 队列处理器按顺序执行保存操作

3. **事件通知**
   - 保存成功：发送 `autosave-complete` 或 `project-save-complete` 事件
   - 保存失败：发送 `autosave-error` 或 `project-save-error` 事件

#### 关键代码：

```go
// 事件监听器将请求加入队列
f.pendingAutoSave = &saveRequest{
    saveType:   "autosave",
    data:       jsonData,
    timestamp:  time.Now().UnixNano(),
    resultChan: nil, // nil 表示事件驱动
}
f.notifySaveQueue() // 通知队列处理器
```

### 2. 前端实现（TypeScript）

#### 2.1 自动保存服务 (`frontend/src/services/autoSaveService.ts`)

**唯一保存函数**：
- `saveToLocalStorage()`: 基于事件的异步保存方法（已移除同步保存机制）
  - 使用 `window.runtime.EventsEmit` 发送保存请求
  - 立即返回，不等待保存完成
  - 完全非阻塞
  - 如果 runtime 不可用，会记录警告但不阻塞

#### 2.2 自动保存 Hook (`frontend/src/hooks/useAutoSave.ts`)

**主要改动**：

1. **使用事件驱动的保存**
   - `performSave` 函数现在使用 `saveToLocalStorageAsync`
   - 立即返回，不阻塞主线程

2. **事件监听**
   - 监听 `autosave-complete` 事件：更新保存时间和指纹
   - 监听 `autosave-error` 事件：记录错误日志
   - 监听 `project-save-complete` 事件：更新项目保存状态
   - 监听 `project-save-error` 事件：记录项目保存错误

3. **状态管理**
   - 只有在收到保存成功事件后才更新指纹和保存时间
   - 确保状态与实际保存结果一致

## 🔄 工作流程

### 事件驱动的保存流程

```
用户操作
  ↓
防抖(1000ms)
  ↓
Web Worker 序列化（不阻塞主线程）
  ↓
EventsEmit("autosave-request", jsonData) ← 立即返回，不阻塞
  ↓
后端事件监听器接收
  ↓
加入保存队列（保持顺序性）
  ↓
队列处理器按顺序执行保存
  ↓
保存完成后发送 EventsEmit("autosave-complete", timestamp)
  ↓
前端事件监听器接收
  ↓
更新 UI 状态（保存时间、指纹等）
```

### 顺序性保证

1. **队列机制**：所有保存请求都通过同一个队列处理
2. **互斥锁**：使用 `pendingSaveMu` 保护队列操作
3. **合并策略**：同一类型的多次保存请求会被合并，只保存最新的数据
4. **顺序执行**：队列处理器按顺序执行保存操作

## 📊 性能优势

| 特性 | 原有实现 | 事件驱动实现 |
|------|---------|-------------|
| **前端阻塞** | ⚠️ await 等待后端完成 | ✅ 立即返回，不阻塞 |
| **磁盘 I/O 影响** | ⚠️ 可能阻塞前端 | ✅ 完全异步，不影响前端 |
| **页面卡顿** | ⚠️ 可能出现 | ✅ 基本消除 |
| **保存顺序性** | ✅ 保证 | ✅ 保证（通过队列） |
| **错误处理** | ✅ 同步错误处理 | ✅ 异步错误通知 |

## 🎯 使用方式

### 自动保存（已自动集成）

自动保存功能已集成到 `useAutoSave` hook 中，无需额外配置。当用户操作触发保存时，会自动使用事件驱动的异步保存方式。

### 手动保存

所有保存操作都使用事件驱动的异步方式：

```typescript
// 事件驱动的异步保存（立即返回，不阻塞）
await saveToLocalStorage(layers, canvasConfig, projectPath);
```

**注意**：函数会立即返回，不等待保存完成。保存状态通过事件通知（`autosave-complete` 或 `project-save-complete`）。

## 🔍 事件说明

### 前端发送的事件

- `autosave-request`: 自动保存请求
  - 参数：`jsonData` (string) - JSON 格式的项目数据

- `project-save-request`: 项目保存请求
  - 参数：`projectPath` (string) - 项目路径
  - 参数：`jsonData` (string) - JSON 格式的项目数据

### 后端发送的事件

- `autosave-complete`: 自动保存完成
  - 参数：`timestamp` (number) - Unix 时间戳

- `autosave-error`: 自动保存失败
  - 参数：`error` (string) - 错误信息

- `project-save-complete`: 项目保存完成
  - 参数：`projectPath` (string) - 项目路径

- `project-save-error`: 项目保存失败
  - 参数：`projectPath` (string) - 项目路径
  - 参数：`error` (string) - 错误信息

## ⚠️ 注意事项

1. **完全异步**：所有保存操作都是事件驱动的，不阻塞前端主线程
2. **状态更新**：保存状态（如保存时间）只有在收到完成事件后才会更新
3. **错误处理**：错误通过事件通知（`autosave-error` 或 `project-save-error`），需要监听错误事件进行处理
4. **顺序性**：保存操作按顺序执行，确保数据一致性
5. **Runtime 检查**：如果 Wails runtime 不可用，保存操作会记录警告但不阻塞应用

## 🚀 后续优化建议

1. **保存进度指示**：可以添加保存进度事件，显示保存状态
2. **批量保存**：对于大量数据，可以考虑批量保存优化
3. **保存重试**：添加保存失败后的自动重试机制
4. **性能监控**：添加保存性能监控，跟踪保存耗时

