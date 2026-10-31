import { describe, it, expect, vi } from "vitest";
import { readCurrentTab } from "./current-tab";
describe("扩展当前网页采集", () => {
  it("仅查询当前窗口的活动网页，并返回标题和地址", async () => {
    const query = vi
      .fn()
      .mockResolvedValue([
        { url: "https://example.com/path", title: "测试网站" },
      ]);
    vi.stubGlobal("chrome", { tabs: { query } });
    expect(await readCurrentTab()).toEqual({
      url: "https://example.com/path",
      title: "测试网站",
    });
    expect(query).toHaveBeenCalledWith({ active: true, currentWindow: true });
  });
  it("拒绝浏览器内部页面和不可读取的页面", async () => {
    vi.stubGlobal("chrome", {
      tabs: {
        query: vi
          .fn()
          .mockResolvedValue([{ url: "chrome://settings", title: "设置" }]),
      },
    });
    await expect(readCurrentTab()).rejects.toThrow(/当前页面无法添加/);
  });
});
