package main

import (
	"fmt"
	"os"
	"path/filepath"
)

func main() {
	// 获取用户配置目录
	userConfigDir, err := os.UserConfigDir()
	if err != nil {
		fmt.Printf("❌ Failed to get user config dir: %v\n", err)
		return
	}

	fmt.Printf("✅ User config dir: %s\n", userConfigDir)

	// 应用配置目录
	appConfigDir := filepath.Join(userConfigDir, "IndrawEditor")
	fmt.Printf("✅ App config dir: %s\n", appConfigDir)

	// 配置文件路径
	configFile := filepath.Join(appConfigDir, "config.json")
	fmt.Printf("✅ Config file path: %s\n", configFile)

	// 检查目录是否存在
	if stat, err := os.Stat(appConfigDir); err == nil {
		if stat.IsDir() {
			fmt.Printf("✅ Config directory exists\n")
		} else {
			fmt.Printf("❌ Config path exists but is not a directory\n")
		}
	} else if os.IsNotExist(err) {
		fmt.Printf("⚠️  Config directory does not exist (will be created on first run)\n")
	} else {
		fmt.Printf("❌ Error checking config directory: %v\n", err)
	}

	// 检查配置文件是否存在
	if stat, err := os.Stat(configFile); err == nil {
		fmt.Printf("✅ Config file exists (size: %d bytes)\n", stat.Size())
		fmt.Printf("✅ File permissions: %s\n", stat.Mode())
	} else if os.IsNotExist(err) {
		fmt.Printf("⚠️  Config file does not exist (will be created on first run)\n")
	} else {
		fmt.Printf("❌ Error checking config file: %v\n", err)
	}

	// 测试写入权限
	testFile := filepath.Join(appConfigDir, ".test_write")
	if err := os.MkdirAll(appConfigDir, 0700); err != nil {
		fmt.Printf("❌ Cannot create config directory: %v\n", err)
		return
	}

	if err := os.WriteFile(testFile, []byte("test"), 0600); err != nil {
		fmt.Printf("❌ Cannot write to config directory: %v\n", err)
	} else {
		fmt.Printf("✅ Config directory is writable\n")
		os.Remove(testFile)
	}
}
