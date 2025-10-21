
import { describe, it, expect } from "vitest";
import { render, screen } from "@/test/test-utils";
import userEvent from "@testing-library/user-event";
import { axe} from "jest-axe";
import { Dashboard } from "@/components/Dashboard";
import { Providers, TVMode } from "@/pages";
import { LeftSidebar } from "@/components/LeftSidebar";


/*pages in <App/> */
/*
<Route path="/" element={<Dashboard />} /> [✅]
<Route path="/tv-mode" element={<TVMode />} /> [✅]
<Route path="/providers" element={<Providers />} /> [✅]
<Route path="/my-providers" element={isViewer() ? <Navigate to="/" replace /> : <MyProviders />} />
<Route path="/integrations" element={<Integrations />} />
<Route path="/settings" element={<Settings />} />
<Route path="/profile" element={<Profile />} />
<Route path="/login" element={<Login />} />
<Route path="/register" element={<Register />} />
<Route path="/alerts" element={<Alerts />} />
<Route path="*" element={<NotFound />} />                 
*/

const testKeyboardNavigation = async (Component: React.ComponentType) => {
  const user = userEvent.setup();
  render(<Component />);

  const tabbables = Array.from(document.querySelectorAll(
    'button:not([disabled]):not([tabindex="-1"]):not([hidden]),' +
    'a[href]:not([tabindex="-1"]):not([hidden]),' +
    'input:not([disabled]):not([tabindex="-1"]):not([hidden]),' +
    'textarea:not([disabled]):not([tabindex="-1"]):not([hidden]),' +
    'select:not([disabled]):not([tabindex="-1"]):not([hidden]),' +
    '[tabindex="0"]:not([hidden])'
  ));
 
  expect(tabbables.length).toBeGreaterThan(1);

  await user.tab();
  const firstFocus = document.activeElement;
  expect(tabbables.includes(firstFocus)).toBe(true);

  await user.tab();
  const secondFocus = document.activeElement;
  expect(secondFocus).toBe(tabbables[1]);

  await user.tab({ shift: true });
  expect(document.activeElement).toBe(firstFocus);
};


const accessibleNameTest = async (Component: React.ComponentType) => {
  const user = userEvent.setup();
  render(<Component />);
  const buttons = screen.queryAllByRole("button");
  for(const button of buttons) {
    expect(button).toHaveAccessibleName();
  }
};


describe("Dashboard Accessibility", () => {
  it("passes axe checks", async () => {
    const {container} = render(<Dashboard />);
    const result = await axe(container);
    expect(result).toHaveNoViolations(); 
  });
  
  it("buttons and links have accessible names", async () => {
    await accessibleNameTest(Dashboard);
  });
  it("keyboard navigation works", async () =>
     await testKeyboardNavigation(Dashboard)
  );
});

describe("TVMode Accessibility", () => {
  it("passes axe checks", async () => {
    const {container} = render(<TVMode />);
    const result = await axe(container);
    expect(result).toHaveNoViolations();
  });

  it("keyboard navigation works", async () => 
    await testKeyboardNavigation(TVMode)
);
  
  it("buttons and links have accessible names", async () =>
     await accessibleNameTest(TVMode)
  );
});

describe("Providers Accessibility", () => {
  it("passes axe checks", async () => {
    const {container} = render(<Providers />);
    const result = await axe(container);
    expect(result).toHaveNoViolations();
  });

  it("keyboard navigation works", async () =>
     await testKeyboardNavigation(Providers)
);
  
  it("buttons and links have accessible names",async () => {
    await accessibleNameTest(Providers);
  });
});

describe("LeftSidebar Accessibility", () => {
  it("passes axe checks", async () => {
    const {container} = render(<LeftSidebar collapsed={false} />);
    const result = await axe(container);
    expect(result).toHaveNoViolations();
  });
});
