# 桌卡生成器 (Name Card Generator) v3.5 • Landscape Edition

**专业、高效、支持全栈持久化的会议桌卡生成工具。**
基于 React + Node.js + Docker 构建，专为 A3 纸张打印优化，**全毫米级单位控制**。

![Screenshot](screenshot.png)

## ✨ 核心功能

*   **双语排版**：自动处理中文/英文姓名、职位、机构名称，支持双面打印布局（设有中折线）。
*   **智能对齐**：
    *   **二字名自动加宽**：自动识别两个字的中文名，增加字间距以对齐三字名宽度（可开关）。
    *   **双面镜像布局**：正面与背面（倒置）自动布局，方便折叠。
*   **批量生成**：支持 Excel (.xlsx, .csv) 导入，一键生成数百张桌卡。
*   **高度可定制**：
    *   **全毫米 (mm) 单位**：字号、间距、偏移量全部使用物理毫米单位，真正的所见即所得。
    *   **顶部导航栏**：快速切换**纵向模式**与**屏幕预览缩放**，操作更便捷。
    *   **侧边栏精调**：全新的参数分组，逻辑更清晰。
    *   **实时预览**：所见即所得的 A3 打印预览。
    *   **参数微调**：参数以 0.1mm / 0.5mm 为步进精确调整。
    *   **裁剪标记**：内置专业印刷裁剪线（0.35mm 细线），支持毫米级位置微调。
*   **字体管理**：支持上传自定义字体（TTF/OTF/WOFF），并持久化保存。
*   **数据持久化**：
    *   所有配置（预设）、上传的字体均保存在服务器端。
    *   Docker 重启后数据不丢失（需挂载卷）。

---

## 🚀 部署指南 (Docker / CasaOS)

本项目已构建为 Docker 镜像，支持 x86 (AMD64) 架构。

### 1. CasaOS 一键导入

如果您使用 CasaOS，可以直接点击 **App Store -> Custom Install -> Import**，粘贴以下 YAML 配置：

```yaml
name: 桌卡生成器
icon: https://cdn-icons-png.flaticon.com/512/10007/10007746.png
image: bbblq/namecard:latest
restart: unless-stopped
ports:
  - target: 80
    published: "3000"
    protocol: tcp
volumes:
  - host: /DATA/AppData/zhuoka
    target: /app/data
    type: bind
environment:
  - PORT=80
```

> **注意**：
> *   `published: "3000"` 可以改为您喜欢的任何端口。
> *   `volumes` 中的 `/DATA/AppData/zhuoka` 是宿主机保存字体和预设的路径，请确保该路径存在或 CasaOS 会自动创建。

### 2. Docker CLI 部署

```bash
docker run -d \
  --name namecard \
  -p 3000:80 \
  -v ./data:/app/data \
  -e PORT=80 \
  --restart unless-stopped \
  bbblq/namecard:latest
```

### 3. Docker Compose 部署

创建 `docker-compose.yml`:

```yaml
version: '3.8'

services:
  app:
    image: bbblq/namecard:latest
    container_name: namecard
    restart: unless-stopped
    ports:
      - "3000:80"
    volumes:
      - ./data:/app/data  # 数据持久化路径
    environment:
      - PORT=80
```

启动服务：
```bash
docker-compose up -d
```

---

## 📖 使用说明

### 1. 批量导入
1.  下载模板（点击界面的“下载导入模板”按钮）。
2.  在 Excel 中填入数据：
    *   `chineseName`: 中文名 (如：张三)
    *   `englishName`: 英文名 (如：San Zhang)
    *   `chineseCompany`: 机构/部门
    *   `englishCompany`: Organization Name
3.  点击“导入数据”上传 Excel 文件。

### 2. 打印设置

本工具专为 **A3 纸** 设计，现已优化为**横向布局**，打印更方便。

#### 首次打印注意事项 ⚠️

1. **预览界面**：
   - 浅灰色背景代表 A3 纸张（420mm × 297mm）
   - 桌卡以**横向**显示（左右对称）
   - 四个角显示裁剪标记和距离数值
   - 距离标注：左右 **32.5mm**，上下 **13.5mm**

2. **打印步骤**：
   - 点击右上角 **"预览打印 (A3)"**
   - **浏览器打印设置**：
     - **纸张尺寸**：选择 **A3**
     - **布局**：选择 **纵向 (Portrait)** ✓（无需调整为横向）
     - **边距**：选择 **无 (None)**
     - **缩放**：选择 **默认 (Default / 100%)**
     - **背景图形**：建议勾选（确保裁剪标记打印）

3. **验证打印精度**：
   - 打印后，使用尺子测量裁剪标记到纸边的距离
   - 应该与标注的数值一致（左右32.5mm，上下13.5mm）
   - 如有偏差，可在侧边栏调节 **"裁剪线偏移"** 补偿

4. **裁剪标记**：
   - 默认开启，打印时会显示
   - 包含距离标注，方便验证打印位置
   - 可在侧边栏关闭或调整位置

### 3. 字体管理
*   点击顶部的 **“字体管理”**。
*   可以直接拖拽 `.ttf` 或 `.otf` 文件上传。
*   上传后在左侧侧边栏的字体下拉框中选择即可。

---

## 🛠️ 开发构建

### 本地开发 (Dev)
```bash
# 1. 安装依赖
npm install

# 2. 启动全栈开发环境 (前端 Vite + 后端 Node)
# 需要两个终端
# Terminal 1 (Backend):
node server/index.js

# Terminal 2 (Frontend):
npm run dev
```

### 构建镜像
```bash
docker build -t namecard-app .
```
