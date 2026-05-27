<template>
  <div class="settings-page">
    <el-tabs v-model="activeTab">
      <!-- 基本配置 -->
      <el-tab-pane label="基本配置" name="basic">
        <el-form :model="form" label-width="180px" style="max-width: 700px">
          <el-form-item label="服务端口">
            <el-input-number v-model="form.port" :min="1" :max="65535" />
            <div class="form-tip">修改后立即生效，服务会自动切换到新端口</div>
          </el-form-item>
          <el-form-item label="公开访问地址">
            <el-input v-model="form.publicUrl" placeholder="https://img.example.com" />
            <div class="form-tip">用于生成API地址，末尾不要加 /</div>
          </el-form-item>
          <el-form-item label="CORS 允许来源">
            <el-input v-model="form.corsOrigins" placeholder="https://a.com,https://b.com" />
            <div class="form-tip">逗号分隔，* 表示全部允许；生产环境建议限制</div>
          </el-form-item>
        </el-form>
      </el-tab-pane>

      <!-- 安全配置 -->
      <el-tab-pane label="安全配置" name="security">
        <el-form :model="form" label-width="180px" style="max-width: 700px">
          <el-form-item label="管理员用户名">
            <el-input v-model="form.adminUser" />
          </el-form-item>
          <el-form-item label="管理员密码">
            <el-input v-model="form.adminPass" type="password" show-password>
              <template #append>
                <el-button @click="generateKey('adminPass')">随机生成</el-button>
              </template>
            </el-input>
            <div class="form-tip">修改后需用新密码重新登录</div>
          </el-form-item>
          <el-form-item label="JWT 密钥">
            <el-input v-model="form.jwtSecret" type="password" show-password>
              <template #append>
                <el-button @click="generateKey('jwtSecret')">随机生成</el-button>
              </template>
            </el-input>
            <div class="form-tip warning">修改后所有已登录用户需重新登录</div>
          </el-form-item>
          <el-form-item label="加密密钥">
            <el-input v-model="form.encryptKey" type="password" show-password>
              <template #append>
                <el-button @click="generateKey('encryptKey')">随机生成</el-button>
              </template>
            </el-input>
            <div class="form-tip danger">⚠️ 修改后已有存储源密钥将无法解密！请先删除所有存储源再修改</div>
          </el-form-item>
        </el-form>
      </el-tab-pane>

      <!-- 上传配置 -->
      <el-tab-pane label="上传配置" name="upload">
        <el-form :model="form" label-width="180px" style="max-width: 700px">
          <el-form-item label="上传大小限制">
            <el-input-number v-model="form.uploadMaxSize" :min="1" :max="200" />
            <span style="margin-left: 8px; color: #909399">MB</span>
          </el-form-item>
          <el-form-item label="单次上传文件数上限">
            <el-input-number v-model="form.uploadMaxFiles" :min="1" :max="100" />
          </el-form-item>
          <el-form-item label="图片缩放最大尺寸">
            <el-input-number v-model="form.resizeMaxDimension" :min="100" :max="16384" :step="256" />
            <span style="margin-left: 8px; color: #909399">px</span>
            <div class="form-tip">通过API请求缩放图片时的最大宽/高，防止DoS</div>
          </el-form-item>
        </el-form>
      </el-tab-pane>

      <!-- 高级配置 -->
      <el-tab-pane label="高级配置" name="advanced">
        <el-form :model="form" label-width="180px" style="max-width: 700px">
          <el-form-item label="数据库路径">
            <el-input v-model="form.dbPath" disabled />
            <div class="form-tip">数据库路径不可在线修改，需手动编辑 .env</div>
          </el-form-item>
          <el-form-item label="缓存最大条目数">
            <el-input-number v-model="form.cacheMaxSize" :min="10" :max="10000" :step="100" />
            <div class="form-tip">内存中缓存的分类数据条数，超限后LRU淘汰</div>
          </el-form-item>
          <el-form-item label="自动保存间隔">
            <el-input-number v-model="form.autoSaveInterval" :min="5" :max="300" />
            <span style="margin-left: 8px; color: #909399">秒</span>
            <div class="form-tip">修改后立即生效</div>
          </el-form-item>
          <el-form-item label="公开API频率限制">
            <el-input-number v-model="form.rateLimitPublic" :min="10" :max="1000" :step="10" />
            <span style="margin-left: 8px; color: #909399">次/分钟</span>
          </el-form-item>
          <el-form-item label="登录频率限制">
            <el-input-number v-model="form.rateLimitLogin" :min="3" :max="60" />
            <span style="margin-left: 8px; color: #909399">次/分钟</span>
          </el-form-item>
        </el-form>
      </el-tab-pane>

      <!-- 系统检测 -->
      <el-tab-pane label="系统检测" name="test">
        <el-button type="primary" @click="runTest" :loading="testLoading">运行系统检测</el-button>
        <div v-if="testResults.length" style="margin-top: 20px">
          <el-descriptions :column="1" border>
            <el-descriptions-item v-for="r in testResults" :key="r.item" :label="r.item">
              <el-tag :type="r.status === 'ok' ? 'success' : 'danger'" size="small">{{ r.status === 'ok' ? '正常' : '异常' }}</el-tag>
              <span style="margin-left: 8px">{{ r.message }}</span>
            </el-descriptions-item>
          </el-descriptions>
        </div>
      </el-tab-pane>
    </el-tabs>

    <!-- 保存按钮 -->
    <div style="margin-top: 24px; max-width: 700px; display: flex; gap: 12px">
      <el-button type="primary" @click="saveSettings" :loading="saving">保存配置</el-button>
      <el-button @click="loadSettings">重置</el-button>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import axios from 'axios'

const activeTab = ref('basic')
const saving = ref(false)
const testLoading = ref(false)
const testResults = ref([])

const form = ref({
  port: 3100,
  adminUser: 'admin',
  adminPass: '',
  jwtSecret: '',
  encryptKey: '',
  dbPath: '',
  publicUrl: '',
  corsOrigins: '',
  uploadMaxSize: 50,
  uploadMaxFiles: 20,
  cacheMaxSize: 500,
  resizeMaxDimension: 4096,
  autoSaveInterval: 30,
  rateLimitPublic: 120,
  rateLimitLogin: 10,
})

const token = localStorage.getItem('token')
const headers = { Authorization: `Bearer ${token}` }

async function loadSettings() {
  try {
    const { data } = await axios.get('/admin/api/settings', { headers })
    if (data.code === 0) {
      form.value = { ...data.data.settings }
    }
  } catch (e) {
    ElMessage.error('加载配置失败: ' + (e.response?.data?.message || e.message))
  }
}

async function saveSettings() {
  // 检查是否有危险操作
  const warnings = []
  if (form.value.encryptKey && !form.value.encryptKey.includes('****')) {
    warnings.push('加密密钥已被修改，如果存储源中有数据，密钥将无法解密！')
  }

  try {
    if (warnings.length) {
      await ElMessageBox.confirm(
        warnings.join('\n'),
        '⚠️ 危险操作确认',
        { confirmButtonText: '我已了解，继续', cancelButtonText: '取消', type: 'warning' }
      )
    }

    saving.value = true
    const oldPort = form.value.port
    const { data } = await axios.put('/admin/api/settings', form.value, { headers })
    if (data.code === 0) {
      ElMessage.success(data.message || '保存成功')
      // 显示警告信息
      if (data.data?.warnings?.length) {
        const msgs = data.data.warnings.map(w => w.message).join('\n')
        ElMessageBox.alert(msgs, '提示', { type: 'warning' })
      }
      // 重新加载以获取脱敏后的值
      await loadSettings()
      // 端口变更提示
      if (form.value.port !== oldPort) {
        const newUrl = window.location.protocol + '//' + window.location.hostname + ':' + form.value.port + '/admin/settings'
        ElMessageBox.alert(
          `端口已从 ${oldPort} 切换到 ${form.value.port}，请访问新地址：\n${newUrl}`,
          '端口已变更',
          { type: 'info', confirmButtonText: '前往新地址' }
        ).then(() => {
          window.location.href = newUrl
        }).catch(() => {})
      }
    } else {
      ElMessage.error(data.message)
    }
  } catch (e) {
    if (e !== 'cancel') {
      ElMessage.error('保存失败: ' + (e.response?.data?.message || e.message))
    }
  } finally {
    saving.value = false
  }
}

async function generateKey(type) {
  try {
    const { data } = await axios.post('/admin/api/settings/generate-key', { type }, { headers })
    if (data.code === 0) {
      form.value[type] = data.data.key
      ElMessage.success('已生成随机密钥')
    }
  } catch (e) {
    ElMessage.error('生成失败: ' + (e.response?.data?.message || e.message))
  }
}

async function runTest() {
  testLoading.value = true
  try {
    const { data } = await axios.post('/admin/api/settings/test', {}, { headers })
    if (data.code === 0) {
      testResults.value = data.data.results
      ElMessage[data.data.allOk ? 'success' : 'warning'](
        data.data.allOk ? '所有检测项通过' : '部分检测项异常，请检查'
      )
    }
  } catch (e) {
    ElMessage.error('检测失败: ' + (e.response?.data?.message || e.message))
  } finally {
    testLoading.value = false
  }
}

onMounted(loadSettings)
</script>

<style scoped>
.settings-page {
  padding: 8px 0;
}
.form-tip {
  font-size: 12px;
  color: #909399;
  margin-top: 2px;
  line-height: 1.5;
}
.form-tip.warning {
  color: #E6A23C;
}
.form-tip.danger {
  color: #F56C6C;
  font-weight: 500;
}
</style>
