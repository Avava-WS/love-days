// 单进程运行全部测试：避免 node --test 为每个文件 spawn 子进程（沙箱会拒绝管道）。
// 用法：node tests/run.mjs
import './dates.test.mjs';
import './lunar.test.mjs';
import './store.test.mjs';
import './occurrence.test.mjs';
