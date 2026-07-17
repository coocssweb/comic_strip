import { User } from '../models/user.model.js';
import { ApiError } from '../utils/api-error.js';

async function findUserOrThrow(userId) {
  const user = await User.findById(userId);

  if (!user) {
    throw new ApiError(404, 40401, '用户不存在');
  }

  return user;
}

export async function createUser(ctx) {
  const user = await User.create(ctx.request.body);
  ctx.success(201, '创建用户成功', user);
}

export async function listUsers(ctx) {
  const users = await User.find().sort({ createdAt: -1 });
  ctx.success(200, '查询用户列表成功', users);
}

export async function getUser(ctx) {
  const user = await findUserOrThrow(ctx.params.id);
  ctx.success(200, '查询用户成功', user);
}

export async function updateUser(ctx) {
  const user = await User.findByIdAndUpdate(ctx.params.id, ctx.request.body, {
    new: true,
    runValidators: true,
  });

  if (!user) {
    throw new ApiError(404, 40401, '用户不存在');
  }

  ctx.success(200, '更新用户成功', user);
}

export async function deleteUser(ctx) {
  const user = await findUserOrThrow(ctx.params.id);
  await user.deleteOne();
  ctx.success(200, '删除用户成功', user);
}
