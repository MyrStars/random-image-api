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

// 路由守卫
router.beforeEach((to, from, next) => {
  const token = localStorage.getItem('token')
  if (!to.meta.public && !token) {
    next('/admin/login')
  } else {
    next()
  }
})

export default router
