@echo off
chcp 65001 >nul
setlocal
cd /d F:\github-dx\wx

echo ====================================
echo   DaoXuan WenJi - Push to GitHub (jygldj/wx)
echo   推送后 Cloudflare Pages 自动部署
echo ====================================
echo.

REM 关键：本机经代理加速 GitHub 时 SSL 校验会失败，
REM 改用 Windows 系统证书 (schannel) 后端即可正常推送。
git config user.email "gswsf@163.com"
git config user.name "jygldj"
git config http.sslbackend schannel
git config http.sslverify true
echo Git 配置已确认（schannel 后端，规避代理 SSL 问题）。
echo.

echo 正在推送到 https://github.com/jygldj/wx.git ...
echo.
git add -A
git commit -m "update: %date% %time%"
git push -u origin main

if %errorlevel% neq 0 (
  echo.
  echo ====================================
  echo   推送失败。常见原因与对策：
  echo   1. 网络 / 代理问题        - 重试一次本脚本
  echo   2. GitHub 登录失效       - 会弹出凭据管理器窗口，登录即可
  echo   3. 本地与远程冲突       - 先手动 git pull 再推
  echo ====================================
  pause
  exit /b 1
)

echo.
echo ====================================
echo   推送成功！Cloudflare 将在 1-2 分钟内自动部署。
echo   访问：https://daoxuanwenji.pages.dev
echo ====================================
pause
