import { useState, useCallback } from 'react';
import { LayerData, CanvasConfig } from '../types';
import {
  SaveProject,
  LoadProject,
  ExportImage,
  SelectDirectory,
  CreateProject,
  SaveProjectToPath,
  LoadProjectFromPath,
  GetRecentProjects,
  RemoveRecentProject,
  ClearRecentProjects,
} from '../../wailsjs/go/core/App';
import { serializationService } from '../services/serializationService';

interface ProjectData {
  version: string;
  timestamp: number;
  layers: LayerData[];
  canvasConfig: CanvasConfig;
}

/**
 * 最近项目信息
 */
export interface RecentProject {
  name: string;
  path: string;
  updatedAt: number;
}

/**
 * 项目信息
 */
export interface ProjectInfo {
  name: string;
  path: string;
  isTemporary: boolean; // 是否为临时项目（未保存到指定路径）
}

/**
 * 项目管理 Hook
 * 提供项目的新建、保存、加载功能
 */
export function useProjectManager() {
  const [isProjectCreated, setIsProjectCreated] = useState(false);
  const [canvasConfig, setCanvasConfig] = useState<CanvasConfig>({
    width: 1080,
    height: 1080,
    background: 'transparent'
  });

  // 项目信息
  const [projectInfo, setProjectInfo] = useState<ProjectInfo | null>(null);

  // 最近项目列表
  const [recentProjects, setRecentProjects] = useState<RecentProject[]>([]);

  // 选择目录
  const selectDirectory = useCallback(async (title?: string): Promise<string | null> => {
    try {
      const dirPath = await SelectDirectory(title || '选择项目保存位置');
      return dirPath || null;
    } catch (error) {
      console.error('Failed to select directory:', error);
      return null;
    }
  }, []);

  // 创建新项目（临时项目，不保存到文件系统）
  const createProject = useCallback((config: CanvasConfig) => {
    setCanvasConfig(config);
    setIsProjectCreated(true);
    setProjectInfo(null); // 临时项目没有路径信息
  }, []);

  // 创建新项目并保存到指定路径
  const createProjectWithPath = useCallback(async (
    name: string,
    parentDir: string,
    config: CanvasConfig
  ): Promise<string | null> => {
    try {
      const canvasConfigJSON = JSON.stringify(config);
      const projectPath = await CreateProject(name, parentDir, canvasConfigJSON);

      if (projectPath) {
        setCanvasConfig(config);
        setIsProjectCreated(true);
        setProjectInfo({
          name,
          path: projectPath,
          isTemporary: false,
        });
        console.log('Project created at:', projectPath);
        return projectPath;
      }
      return null;
    } catch (error) {
      console.error('Failed to create project:', error);
      throw error;
    }
  }, []);

  // 保存项目（使用 Wails 后端）
  // 如果项目有路径，直接保存；否则弹出对话框
  const saveProject = useCallback(async (layers: LayerData[]) => {
    const projectData: ProjectData = {
      version: '1.0',
      timestamp: Date.now(),
      layers: layers,
      canvasConfig: canvasConfig
    };

    try {
      if (projectInfo && !projectInfo.isTemporary) {
        // 项目有路径，直接保存
        const jsonString = await serializationService.serialize(projectData);
        await SaveProjectToPath(projectInfo.path, jsonString);
        console.log('Project saved to:', projectInfo.path);
      } else {
        // 临时项目，弹出对话框
        const suggestedName = `indraw-project-${new Date().toISOString().slice(0, 10)}.json`;
        const jsonString = await serializationService.serialize(projectData);
        const filePath = await SaveProject(jsonString, suggestedName);
        if (filePath) {
          console.log('Project saved to:', filePath);
        }
      }
    } catch (error) {
      console.error('Failed to save project:', error);
      throw error;
    }
  }, [canvasConfig, projectInfo]);

  // 保存项目到指定路径（用于自动保存）
  const saveProjectToPath = useCallback(async (layers: LayerData[]) => {
    if (!projectInfo || projectInfo.isTemporary) {
      return; // 临时项目不进行路径保存
    }

    const projectData: ProjectData = {
      version: '1.0',
      timestamp: Date.now(),
      layers: layers,
      canvasConfig: canvasConfig
    };

    try {
      const jsonString = await serializationService.serialize(projectData);
      await SaveProjectToPath(projectInfo.path, jsonString);
    } catch (error) {
      console.error('Failed to auto-save project:', error);
    }
  }, [canvasConfig, projectInfo]);

  // 加载项目（使用 Wails 后端，弹出目录选择对话框）
  const loadProject = useCallback(async (): Promise<{ layers: LayerData[], config: CanvasConfig }> => {
    try {
      const projectJSON = await LoadProject();
      if (!projectJSON) {
        throw new Error("No project selected");
      }

      // 解析返回数据，包含项目路径信息
      const response = JSON.parse(projectJSON) as ProjectData & {
        projectPath?: string;
        projectName?: string;
      };

      if (response.layers && Array.isArray(response.layers)) {
        const config = response.canvasConfig || canvasConfig;
        setCanvasConfig(config);
        setIsProjectCreated(true);
        
        // 如果返回了项目路径，设置项目信息
        if (response.projectPath) {
          setProjectInfo({
            name: response.projectName || response.projectPath.split(/[/\\]/).pop() || 'Untitled',
            path: response.projectPath,
            isTemporary: false,
          });
        } else {
          // 兼容旧格式，视为临时项目
          setProjectInfo(null);
        }
        
        return { layers: response.layers, config };
      } else {
        throw new Error("Invalid project file format");
      }
    } catch (err: any) {
      throw new Error(err.message || "Failed to load project");
    }
  }, [canvasConfig]);

  // 从指定路径加载项目
  const loadProjectFromPath = useCallback(async (
    projectPath: string,
    projectName?: string
  ): Promise<{ layers: LayerData[], config: CanvasConfig }> => {
    try {
      const projectJSON = await LoadProjectFromPath(projectPath);
      if (!projectJSON) {
        throw new Error("Failed to load project from path");
      }

      const project: ProjectData = JSON.parse(projectJSON);

      if (project.layers && Array.isArray(project.layers)) {
        const config = project.canvasConfig || canvasConfig;
        setCanvasConfig(config);
        setIsProjectCreated(true);
        setProjectInfo({
          name: projectName || projectPath.split(/[/\\]/).pop() || 'Untitled',
          path: projectPath,
          isTemporary: false,
        });
        return { layers: project.layers, config };
      } else {
        throw new Error("Invalid project file format");
      }
    } catch (err: any) {
      throw new Error(err.message || "Failed to load project");
    }
  }, [canvasConfig]);

  // 获取最近项目列表
  const fetchRecentProjects = useCallback(async () => {
    try {
      const result = await GetRecentProjects();
      const data = JSON.parse(result);
      setRecentProjects(data.projects || []);
      return data.projects || [];
    } catch (error) {
      console.error('Failed to fetch recent projects:', error);
      return [];
    }
  }, []);

  // 从最近项目列表中移除
  const removeFromRecentProjects = useCallback(async (path: string) => {
    try {
      await RemoveRecentProject(path);
      await fetchRecentProjects();
    } catch (error) {
      console.error('Failed to remove recent project:', error);
    }
  }, [fetchRecentProjects]);

  // 清除最近项目列表
  const clearRecentProjects = useCallback(async () => {
    try {
      await ClearRecentProjects();
      setRecentProjects([]);
    } catch (error) {
      console.error('Failed to clear recent projects:', error);
    }
  }, []);

  return {
    // 状态
    isProjectCreated,
    setIsProjectCreated,
    canvasConfig,
    setCanvasConfig,
    projectInfo,
    recentProjects,

    // 项目操作
    selectDirectory,
    createProject,
    createProjectWithPath,
    saveProject,
    saveProjectToPath,
    loadProject,
    loadProjectFromPath,

    // 最近项目
    fetchRecentProjects,
    removeFromRecentProjects,
    clearRecentProjects,
  };
}

