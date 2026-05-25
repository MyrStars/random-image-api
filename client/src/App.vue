<template>
  <div v-if="route.name === 'Login'" class="login-wrapper">
    <router-view />
  </div>
  <el-container v-else class="app-container">
    <el-aside width="200px" class="app-aside">
      <div class="logo">
        <el-icon><Picture /></el-icon>
        <span>图片API管理</span>
      </div>
      <el-menu
        :default-active="route.path"
        router
        background-color="#304156"
        text-color="#bfcbd9"
        active-text-color="#409eff"
      >
        <el-menu-item index="/admin/dashboard">
          <el-icon><Odometer /></el-icon>
          <span>仪表盘</span>
        </el-menu-item>
        <el-menu-item index="/admin/storages">
          <el-icon><Cloudy /></el-icon>
          <span>存储源管理</span>
        </el-menu-item>
        <el-menu-item index="/admin/categories">
          <el-icon><FolderOpened /></el-icon>
          <span>分类管理</span>
        </el-menu-item>
        <el-menu-item index="/admin/images">
          <el-icon><Picture /></el-icon>
          <span>图片管理</span>
        </el-menu-item>
        <el-menu-item index="/admin/db">
          <el-icon><Coin /></el-icon>
          <span>数据浏览</span>
        </el-menu-item>
      </el-menu>
    </el-aside>
    <el-container>
      <el-header class="app-header">
        <span class="page-title">{{ pageTitle }}</span>
        <el-dropdown @command="handleCommand">
          <span class="user-info">
            <el-icon><User /></el-icon>
            {{ username }}
            <el-icon><ArrowDown /></el-icon>
          </span>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="logout">退出登录</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </el-header>
      <el-main class="app-main">
        <router-view />
      </el-main>
    </el-container>
  </el-container>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()
const username = localStorage.getItem('username') || 'admin'

const titleMap = {
  Dashboard: '仪表盘',
  Storages: '存储源管理',
  Categories: '分类管理',
  Images: '图片管理',
  Database: '数据浏览',
}
const pageTitle = computed(() => titleMap[route.name] || '随机图片API')

function handleCommand(cmd) {
  if (cmd === 'logout') {
    localStorage.removeItem('token')
    localStorage.removeItem('username')
    router.push('/admin/login')
  }
}
</script>

<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
html, body, #app { height: 100%; }
body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; }

.login-wrapper {
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.app-container { height: 100vh; }

.app-aside {
  background-color: #304156;
  overflow-y: auto;
}

.logo {
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: #fff;
  font-size: 16px;
  font-weight: 600;
  border-bottom: 1px solid rgba(255,255,255,0.1);
}
.logo .el-icon { font-size: 22px; }

.app-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid #e6e6e6;
  background: #fff;
}

.page-title { font-size: 18px; font-weight: 600; color: #303133; }

.user-info {
  display: flex;
  align-items: center;
  gap: 4px;
  cursor: pointer;
  color: #606266;
}

.app-main {
  background: #f5f7fa;
  overflow-y: auto;
}

.el-menu { border-right: none !important; }
</style>
