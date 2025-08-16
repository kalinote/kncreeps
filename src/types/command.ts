/**
 * 命令元数据
 */
export interface CommandMetadata {
  namespace: string;  // 命令所属的命名空间，如 "task"
  name: string;       // 命令名称，如 "add"
  description: string; // 命令描述
  fullPath: string;   // 完整路径，如 "task.add"
  method: Function;   // 命令方法
  target: any;        // 命令目标对象
  propertyKey: string;// 命令属性键
}

/**
 * 命令注册信息
 */
export interface CommandRegistration {
  fullPath: string;   // 完整路径，如 "task.add"
  metadata: CommandMetadata; // 命令元数据
  registered: boolean; // 是否已注册
}
