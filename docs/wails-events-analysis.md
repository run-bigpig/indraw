# Wails 事件系统对自动保存优化的分析

## 📋 当前实现分析

### 现有架构
1. **前端序列化**：已使用 Web Worker 进行 JSON 序列化（✅ 已优化）
2. **前端调用**：使用 `await AutoSave(jsonString)` 等待后端完成（⚠️ 可能阻塞）
3. **后端处理**：使用队列合并策略，50ms 批处理间隔（✅ 已优化）

### 当前流程
```
用户操作 → 防抖(1000ms) → Web Worker 序列化 → await AutoSave() → 等待后端完成 → 返回
```

### 潜在问题
- **前端等待**：虽然后端是异步的，但前端的 `await` 仍然会阻塞前端代码执行
- **磁盘 I/O 阻塞**：如果磁盘写入较慢，前端会等待
- **无法完全解耦**：前端需要等待保存结果才能继续

---

## 🎯 Wails 事件系统特性

### 核心 API
1. **EventsEmit**：发送事件（Go 和 JavaScript 都支持）
   ```go
   runtime.EventsEmit(ctx, "autosave-request", jsonData)
   ```
   ```javascript
   window.runtime.EventsEmit("autosave-request", jsonData)
   ```

2. **EventsOn**：监听事件（Go 和 JavaScript 都支持）
   ```go
   runtime.EventsOn(ctx, "autosave-request", func(data ...interface{}) {
       // 处理保存请求
   })
   ```
   ```javascript
   window.runtime.EventsOn("autosave-complete", (success) => {
       // 处理保存完成通知
   })
   ```

3. **EventsOff**：取消监听

### 关键优势
- ✅ **完全异步**：事件发送后立即返回，不阻塞
- ✅ **解耦通信**：前端和后端通过事件通信，不需要直接调用
- ✅ **非阻塞**：Go 的并发特性可以在后台执行操作而不阻塞 UI 线程
- ✅ **实时通知**：后端可以通过事件通知前端保存状态

---

## 💡 使用事件系统优化自动保存

### 优化方案

#### 方案 1：事件驱动的异步保存（推荐）

**前端改进**：
```typescript
// 不再等待结果，直接发送事件
export async function saveToLocalStorage(
  layers: LayerData[],
  canvasConfig: CanvasConfig,
  projectPath?: string
): Promise<void> {  // 改为 void，不返回结果
  const data: AutoSaveData = {
    version: '1.0',
    timestamp: Date.now(),
    layers,
    canvasConfig,
  };

  // Web Worker 序列化
  const jsonString = await serializationService.serialize(data);

  // 发送事件，不等待结果
  if (projectPath) {
    window.runtime.EventsEmit("project-save-request", projectPath, jsonString);
  } else {
    window.runtime.EventsEmit("autosave-request", jsonString);
  }
  
  // 立即返回，不阻塞
}
```

**后端改进**：
```go
// 在 Startup 中注册事件监听器
func (f *FileService) Startup(ctx context.Context) {
    f.ctx = ctx
    
    // 监听自动保存事件
    runtime.EventsOn(ctx, "autosave-request", func(data ...interface{}) {
        if len(data) > 0 {
            jsonData := data[0].(string)
            go func() {  // 在 goroutine 中执行，不阻塞
                err := f.AutoSave(jsonData)
                // 发送完成事件
                if err != nil {
                    runtime.EventsEmit(ctx, "autosave-error", err.Error())
                } else {
                    runtime.EventsEmit(ctx, "autosave-complete", time.Now().Unix())
                }
            }()
        }
    })
    
    // 监听项目保存事件
    runtime.EventsOn(ctx, "project-save-request", func(data ...interface{}) {
        if len(data) >= 2 {
            projectPath := data[0].(string)
            jsonData := data[1].(string)
            go func() {
                err := f.SaveProjectToPath(projectPath, jsonData)
                if err != nil {
                    runtime.EventsEmit(ctx, "project-save-error", err.Error())
                } else {
                    runtime.EventsEmit(ctx, "project-save-complete", projectPath)
                }
            }()
        }
    })
    
    // 启动保存队列处理器
    f.saveQueueOnce.Do(func() {
        go f.processSaveQueue()
    })
}
```

**前端监听保存状态**（可选）：
```typescript
// 在 useAutoSave hook 中监听保存完成事件
useEffect(() => {
    const unsubscribe = window.runtime.EventsOn("autosave-complete", (timestamp) => {
        setLastSaveTime(formatTimestamp(timestamp));
        console.log('[AutoSave] 保存完成');
    });
    
    const errorUnsubscribe = window.runtime.EventsOn("autosave-error", (error) => {
        console.error('[AutoSave] 保存失败:', error);
    });
    
    return () => {
        unsubscribe();
        errorUnsubscribe();
    };
}, []);
```

### 性能优势对比

| 特性 | 当前实现 | 事件系统优化 |
|------|---------|-------------|
| **前端阻塞** | ⚠️ await 等待后端完成 | ✅ 立即返回，不阻塞 |
| **磁盘 I/O 影响** | ⚠️ 可能阻塞前端 | ✅ 完全异步，不影响前端 |
| **解耦程度** | ⚠️ 紧耦合（需要等待结果） | ✅ 完全解耦（事件驱动） |
| **错误处理** | ✅ 同步错误处理 | ✅ 异步错误通知 |
| **状态通知** | ❌ 无 | ✅ 可选的完成/错误事件 |

---

## 🎯 优化效果评估

### 预期改进

1. **消除页面卡顿** ⭐⭐⭐⭐⭐
   - 前端不再等待保存完成，立即返回
   - 用户操作不会被保存操作阻塞
   - 特别适合频繁的自动保存场景

2. **降低主线程压力** ⭐⭐⭐⭐
   - 保存操作完全在后台执行
   - 前端只负责发送事件，不等待结果
   - 配合现有的 Web Worker 序列化，主线程压力最小

3. **提升用户体验** ⭐⭐⭐⭐⭐
   - 界面响应更流畅
   - 可以显示保存状态（可选）
   - 错误处理更优雅（通过事件通知）

### 适用场景

✅ **强烈推荐**：
- 自动保存功能（频繁触发）
- 后台任务处理
- 需要实时状态更新的场景

⚠️ **需要权衡**：
- 如果前端需要立即知道保存结果（如用户手动保存），可以保留同步方法
- 可以同时提供同步和异步两种方式

---

## 📝 实施建议

### 渐进式迁移

1. **第一阶段**：保留现有同步方法，添加事件驱动版本
   ```typescript
   // 同步版本（保留）
   export async function saveToLocalStorageSync(...)
   
   // 异步版本（新增）
   export function saveToLocalStorageAsync(...)
   ```

2. **第二阶段**：在自动保存中使用异步版本
   ```typescript
   // useAutoSave 中使用异步版本
   const performSave = useCallback(async () => {
       // ... 序列化 ...
       saveToLocalStorageAsync(layers, canvasConfig, projectPath);
       // 不等待结果，立即返回
   }, []);
   ```

3. **第三阶段**：添加状态监听（可选）
   - 监听保存完成事件
   - 更新 UI 状态
   - 显示保存成功/失败提示

### 注意事项

1. **错误处理**：确保监听错误事件并妥善处理
2. **状态管理**：如果需要显示保存状态，需要维护状态
3. **向后兼容**：保留同步方法，确保现有代码不受影响

---

## ✅ 结论

**Wails 事件系统对自动保存优化非常有帮助**：

1. ✅ **可以消除页面卡顿**：前端不再等待保存完成
2. ✅ **降低主线程压力**：完全异步，不阻塞 UI
3. ✅ **提升用户体验**：界面响应更流畅
4. ✅ **更好的架构**：事件驱动，解耦更彻底

**建议**：采用事件系统优化自动保存功能，特别是频繁触发的自动保存场景。

