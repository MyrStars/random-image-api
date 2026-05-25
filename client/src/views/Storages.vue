<template>
  <div>
    <div class="toolbar">
      <el-button type="primary" @click="openDialog()"><el-icon><Plus /></el-icon>添加存储源</el-button>
    </div>

    <el-table :data="storages" v-loading="loading" stripe>
      <el-table-column prop="id" label="ID" width="60" />
      <el-table-column prop="name" label="名称" />
      <el-table-column prop="type" label="类型" width="120">
        <template #default="{ row }">
          <el-tag>{{ typeName(row.type) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="endpoint" label="访问域名" show-overflow-tooltip />
      <el-table-column prop="status" label="状态" width="80">
        <template #default="{ row }">
          <el-tag :type="row.status ? 'success' : 'danger'">{{ row.status ? '启用' : '禁用' }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="260" fixed="right">
        <template #default="{ row }">
          <el-button type="primary" link @click="testConn(row.id)">测试连接</el-button>
          <el-button type="warning" link @click="openDialog(row)">编辑</el-button>
          <el-button type="danger" link @click="handleDelete(row.id)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <!-- 新增/编辑弹窗 -->
    <el-dialog v-model="dialogVisible" :title="editingId ? '编辑存储源' : '添加存储源'" width="560px" destroy-on-close>
      <el-form ref="formRef" :model="form" :rules="rules" label-width="100px">
        <el-form-item label="名称" prop="name">
          <el-input v-model="form.name" placeholder="如：七牛云主存储" />
        </el-form-item>
        <el-form-item label="存储类型" prop="type">
          <el-select v-model="form.type" style="width:100%">
            <el-option v-for="t in supportedTypes" :key="t.type" :label="t.name" :value="t.type" />
          </el-select>
        </el-form-item>
        <template v-if="form.type === 'qiniu'">
          <el-form-item label="AccessKey" prop="config.accessKey">
            <el-input v-model="form.config.accessKey" placeholder="七牛云 AccessKey" />
          </el-form-item>
          <el-form-item label="SecretKey" prop="config.secretKey">
            <el-input v-model="form.config.secretKey" type="password" placeholder="七牛云 SecretKey" show-password />
          </el-form-item>
          <el-form-item label="Bucket" prop="config.bucket">
            <el-input v-model="form.config.bucket" placeholder="存储桶名称" />
          </el-form-item>
          <el-form-item label="区域">
            <el-select v-model="form.config.region" style="width:100%" clearable placeholder="选择区域（可选）">
              <el-option label="华东 z0" value="z0" />
              <el-option label="华北 z1" value="z1" />
              <el-option label="华南 z2" value="z2" />
              <el-option label="北美 na0" value="na0" />
              <el-option label="东南亚 as0" value="as0" />
            </el-select>
          </el-form-item>
        </template>
        <el-form-item label="访问域名" prop="endpoint">
          <el-input v-model="form.endpoint" placeholder="如 https://cdn.example.com" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="handleSave">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import api from '../api'

const storages = ref([])
const supportedTypes = ref([])
const loading = ref(false)
const dialogVisible = ref(false)
const saving = ref(false)
const editingId = ref(null)
const formRef = ref()

const defaultConfig = () => ({ accessKey: '', secretKey: '', bucket: '', region: '' })
const form = reactive({
  name: '',
  type: 'qiniu',
  config: defaultConfig(),
  endpoint: '',
})

const rules = {
  name: [{ required: true, message: '请输入名称', trigger: 'blur' }],
  type: [{ required: true, message: '请选择类型', trigger: 'change' }],
}

const typeNames = { qiniu: '七牛云', aliyun_oss: '阿里云OSS', tencent_cos: '腾讯云COS', cloudflare_r2: 'R2', minio: 'MinIO' }
function typeName(type) { return typeNames[type] || type }

async function load() {
  loading.value = true
  const [storagesRes, typesRes] = await Promise.all([api.get('/storages'), api.get('/storages/types')])
  if (storagesRes.code === 0) storages.value = storagesRes.data
  if (typesRes.code === 0) supportedTypes.value = typesRes.data
  loading.value = false
}

function openDialog(row) {
  if (row) {
    editingId.value = row.id
    form.name = row.name
    form.type = row.type
    form.endpoint = row.endpoint || ''
    form.config = row.config ? { ...row.config } : defaultConfig()
  } else {
    editingId.value = null
    form.name = ''
    form.type = 'qiniu'
    form.endpoint = ''
    form.config = defaultConfig()
  }
  dialogVisible.value = true
}

async function handleSave() {
  await formRef.value.validate()
  saving.value = true
  try {
    const data = { ...form }
    if (editingId.value) {
      await api.put(`/storages/${editingId.value}`, data)
      ElMessage.success('更新成功')
    } else {
      await api.post('/storages', data)
      ElMessage.success('添加成功')
    }
    dialogVisible.value = false
    load()
  } catch {} finally {
    saving.value = false
  }
}

async function testConn(id) {
  const res = await api.post(`/storages/${id}/test`)
  if (res.code === 0 && res.data.success) {
    ElMessage.success(res.data.message)
  } else {
    ElMessage.error(res.data?.message || '测试失败')
  }
}

async function handleDelete(id) {
  await ElMessageBox.confirm('确定删除该存储源？', '确认')
  await api.delete(`/storages/${id}`)
  ElMessage.success('删除成功')
  load()
}

onMounted(load)
</script>

<style scoped>
.toolbar { margin-bottom: 16px; }
</style>
