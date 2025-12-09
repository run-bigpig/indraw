# Wails 事件系统前后端绑定指南

根据 Wails 官方文档，本文档说明正确的事件系统绑定方式。

## 📋 后端（Go）实现

### 导入包
```go
import (
    "context"
    "github.com/wailsapp/wails/v2/pkg/runtime"
)
```

### 监听前端事件
在 `Startup` 方法中注册事件监听器：

```go
func (a *App) Startup(ctx context.Context) {
    a.ctx = ctx
    
    // 监听前端发送的事件
    runtime.EventsOn(ctx, "eventName", func(optionalData ...interface{}) {
        // 处理事件
        if len(optionalData) > 0 {
            data := optionalData[0].(string) // 类型断言
            // 处理数据
        }
    })
}
```

### 发送事件到前端
```go
// 发送事件，可附带数据
runtime.EventsEmit(ctx, "eventName", data1, data2, ...)
```

### 完整示例
```go
func (f *FileService) Startup(ctx context.Context) {
    f.ctx = ctx
    
    // 监听自动保存事件
    runtime.EventsOn(ctx, "autosave-request", func(data ...interface{}) {
        if len(data) == 0 {
            runtime.EventsEmit(ctx, "autosave-error", "缺少保存数据")
            return
        }
        
        jsonData, ok := data[0].(string)
        if !ok {
            runtime.EventsEmit(ctx, "autosave-error", "无效的数据格式")
            return
        }
        
        // 处理保存请求...
        // 完成后发送完成事件
        runtime.EventsEmit(ctx, "autosave-complete", time.Now().Unix())
    })
}
```

---

## 📋 前端（TypeScript/JavaScript）实现

### 方式 1：直接使用 window.runtime（推荐，符合官方文档）

#### 类型声明
```typescript
declare global {
  interface Window {
    runtime?: {
      EventsOn: (eventName: string, callback: (...data: any) => void) => () => void;
      EventsEmit: (eventName: string, ...data: any) => void;
      EventsOnMultiple: (eventName: string, callback: (...data: any) => void, maxCallbacks: number) => () => void;
      EventsOnce: (eventName: string, callback: (...data: any) => void) => () => void;
      EventsOff: (eventName: string, ...additionalEventNames: string[]) => void;
      EventsOffAll: () => void;
    };
  }
}
```

#### 监听后端事件
```typescript
// 检查 runtime 是否可用
if (typeof window !== 'undefined' && window.runtime && window.runtime.EventsOn) {
    // 监听事件，返回取消订阅的函数
    const unsubscribe = window.runtime.EventsOn('eventName', (data) => {
        // 处理事件数据
        console.log('Received:', data);
    });
    
    // 清理时取消订阅
    return () => {
        if (unsubscribe) unsubscribe();
    };
}
```

#### 发送事件到后端
```typescript
// 检查 runtime 是否可用
if (typeof window !== 'undefined' && window.runtime && window.runtime.EventsEmit) {
    // 发送事件，可附带多个参数
    window.runtime.EventsEmit('eventName', data1, data2, ...);
}
```

#### React Hook 完整示例
```typescript
useEffect(() => {
    // 检查 runtime 是否可用
    if (typeof window === 'undefined' || !window.runtime || !window.runtime.EventsOn) {
        console.warn('Wails runtime 不可用，跳过事件监听器注册');
        return;
    }

    // 监听保存完成事件
    const unsubscribeComplete = window.runtime.EventsOn('autosave-complete', (timestamp: number) => {
        console.log('保存完成:', timestamp);
        // 更新状态...
    });

    // 监听错误事件
    const unsubscribeError = window.runtime.EventsOn('autosave-error', (error: string) => {
        console.error('保存失败:', error);
    });

    // 清理函数
    return () => {
        try {
            if (unsubscribeComplete) unsubscribeComplete();
            if (unsubscribeError) unsubscribeError();
        } catch (error) {
            console.warn('清理事件监听器时出错:', error);
        }
    };
}, []);
```

### 方式 2：使用 wailsjs/runtime 导入（也可以，但需要确保 runtime 已初始化）

```typescript
import { EventsOn, EventsEmit } from '../../wailsjs/runtime/runtime';

// 监听事件
const unsubscribe = EventsOn('eventName', (data) => {
    // 处理事件
});

// 发送事件
EventsEmit('eventName', data);
```

**注意**：这种方式内部会调用 `window.runtime.EventsOn`，如果 runtime 未初始化会报错。

---

## 🔑 关键要点

### 1. 运行时检查
**必须**在使用前检查 `window.runtime` 是否可用：

```typescript
if (typeof window !== 'undefined' && window.runtime && window.runtime.EventsOn) {
    // 安全使用
}
```

### 2. 事件监听器清理
`EventsOn` 返回一个取消订阅的函数，**必须**在组件卸载时调用：

```typescript
const unsubscribe = window.runtime.EventsOn('eventName', callback);

// 清理
return () => {
    if (unsubscribe) unsubscribe();
};
```

### 3. 类型安全
使用 TypeScript 时，需要声明 `window.runtime` 的类型，避免类型错误。

### 4. 错误处理
- 后端：使用类型断言时注意处理类型错误
- 前端：检查 runtime 可用性，提供回退方案

---

## 📊 当前实现

### 后端（`core/service/file_service.go`）
✅ 正确使用 `runtime.EventsOn(ctx, ...)` 和 `runtime.EventsEmit(ctx, ...)`

### 前端（`frontend/src/hooks/useAutoSave.ts`）
✅ 使用 `window.runtime.EventsOn` 直接访问
✅ 添加了运行时检查
✅ 正确清理事件监听器

### 前端（`frontend/src/services/autoSaveService.ts`）
✅ 使用 `window.runtime.EventsEmit` 直接访问
✅ 添加了运行时检查和回退机制

---

## 🎯 最佳实践

1. **始终检查 runtime 可用性**：在开发环境或 runtime 未初始化时提供回退
2. **清理事件监听器**：避免内存泄漏
3. **类型安全**：使用 TypeScript 类型声明
4. **错误处理**：妥善处理类型断言和运行时错误
5. **使用官方推荐方式**：直接使用 `window.runtime` API

---

## 📚 参考资源

- [Wails 官方文档 - Events](https://wails.io/docs/reference/runtime/events)
- [Wails GitHub 仓库](https://github.com/wailsapp/wails)

