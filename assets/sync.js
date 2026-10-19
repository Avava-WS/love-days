// 同步预留接口：v1 只做本地存储，不发起任何网络请求。
//
// 将来接云端时保持同样的契约：
//   - pull(): 拉取远端数据，返回 { state, updatedAt } 或 null；
//   - push(state): 推送当前整包数据，返回 { ok, updatedAt }；
//   - 冲突按 settings.updatedAt 比较，较新的一方胜出。
// 应用只需把 createSyncAdapter() 换成真实实现，页面逻辑不用改。
export function createSyncAdapter() {
  return {
    mode: 'local',
    async pull() {
      return null;
    },
    async push() {
      return { ok: true, mode: 'local' };
    },
  };
}
