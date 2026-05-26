import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  {
    path: '/admin/login',
    name: 'Login',
    component: () => import('../views/Login.vue'),
    meta: { public: true },
  },
  {
    path: '/admin',
    redirect: '/admin/dashboard',
  },
  {
    path: '/admin/dashboard',
    name: 'Dashboard',
    component: () => import('../views/Dashboard.vue'),
  },
  {
    path: '/admin/storages',
    name: 'Storages',
    component: () => import('../views/Storages.vue'),
  },
  {
    path: '/admin/categories',
    name: 'Categories',
    component: () => import('../views/Categories.vue'),
  },
  {
    path: '/admin/images',
    name: 'Images',
    component: () => import('../views/Images.vue'),
  },
  {
    path: '/admin/db',
    name: 'Database',
    component: () => import('../views/Database.vue'),
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

/**
 * 简易JWT过期检查（不验证签名，仅检查exp字段）
 * 真正的验证由后端 auth middleware 完成
 */
function isTokenExpired(token) {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]))
    if (payload.exp && payload.exp * 1000 < Date.now()) {
      return true
    }
    return false
  } catch {
    return true
  }
}

// 路由守卫
router.beforeEach((to, from, next) => {
  const token = localStorage.getItem('token')
  if (!to.meta.public) {
    if (!token || isTokenExpired(token)) {
      localStorage.removeItem('token')
      next('/admin/login')
    } else {
      next()
    }
  } else {
    next()
  }
})

export default router
