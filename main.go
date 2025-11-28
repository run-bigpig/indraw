package main

import (
	"embed"
	"indraw/core"

	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
	"github.com/wailsapp/wails/v2/pkg/options/windows"
)

//go:embed all:frontend/dist
var assets embed.FS

func main() {
	// Create an instance of the app structure
	app := core.NewApp()

	// Create application with options
	err := wails.Run(&options.App{
		Title:     "Nebula AI Studio",
		Width:     1280,
		Height:    800,
		MinWidth:  1024,
		MinHeight: 700,
		AssetServer: &assetserver.Options{
			Assets: assets,
		},
		// 深色背景，与前端 tech-900 (#0B0E14) 匹配
		BackgroundColour: &options.RGBA{R: 11, G: 14, B: 20, A: 255},
		OnStartup:        app.Startup,
		// 启用右键菜单（开发调试用）
		EnableDefaultContextMenu: true,
		Bind: []interface{}{
			app,
		},
		// Windows 特定配置
		Windows: &windows.Options{
			// 使用系统主题
			Theme: windows.SystemDefault,
			// 禁用缩放控制（避免布局问题）
			DisablePinchZoom: true,
		},
	})

	if err != nil {
		println("Error:", err.Error())
	}
}
