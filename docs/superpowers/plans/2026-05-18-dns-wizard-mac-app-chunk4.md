## Chunk 4: Admin Escalation Commands & Final Wiring

### Task 4.1: Add admin escalation commands to Rust backend

**Files:**
- Modify: `src-tauri/src/lib.rs`

- [ ] **Step 1: Add `execute_admin_apply` and `execute_admin_restore` commands**

The `authorizeApply` and `authorizeRestore` callbacks in the frontend invoke `execute_admin_apply` and `execute_admin_restore` to trigger `osascript` with admin privileges.

Edit `src-tauri/src/lib.rs` — add the following inside the `run()` function's `invoke_handler`, and add the two new command functions above `run()`.

Insert after the `restore_dns` command and before `pub fn run()`:

```rust
#[tauri::command]
async fn execute_admin_apply(
    primary: String,
    secondary: String,
    shell: tauri_plugin_shell::ShellExt<tauri::Wry>,
) -> Result<ConfigResult, String> {
    let service = detect_network_service().map_err(|e| e)?;
    let script = format!(
        "do shell script \"networksetup -setdnsservers {} {} {}\" with administrator privileges",
        service, primary, secondary
    );
    let output = shell
        .shell("osascript")
        .args(["-e", &script])
        .output()
        .await
        .map_err(|e| format!("Failed to execute osascript: {}", e))?;

    if output.status.success() {
        Ok(ConfigResult {
            success: true,
            message: format!("DNS updated to {} and {}", primary, secondary),
        })
    } else {
        Ok(ConfigResult {
            success: false,
            message: "Authorization cancelled or failed.".to_string(),
        })
    }
}

#[tauri::command]
async fn execute_admin_restore(
    shell: tauri_plugin_shell::ShellExt<tauri::Wry>,
) -> Result<ConfigResult, String> {
    let service = detect_network_service().map_err(|e| e)?;
    let script = format!(
        "do shell script \"networksetup -setdnsservers {} empty\" with administrator privileges",
        service
    );
    let output = shell
        .shell("osascript")
        .args(["-e", &script])
        .output()
        .await
        .map_err(|e| format!("Failed to execute osascript: {}", e))?;

    if output.status.success() {
        Ok(ConfigResult {
            success: true,
            message: "DNS restored to automatic (DHCP)".to_string(),
        })
    } else {
        Ok(ConfigResult {
            success: false,
            message: "Authorization cancelled or failed.".to_string(),
        })
    }
}
```

Update the `invoke_handler` inside `run()` to include the new commands:

```rust
.invoke_handler(tauri::generate_handler![
    run_benchmark,
    apply_dns,
    restore_dns,
    execute_admin_apply,
    execute_admin_restore
])
```

- [ ] **Step 2: Verify `detect_network_service` is `pub` in sys_config.rs**

In `src-tauri/src/sys_config.rs`, the `detect_network_service` function must be `pub fn` (not `fn`) so `lib.rs` can call it. The chunk 2 plan already writes it as `pub fn`. If executing from scratch, this is already correct. Verify:

```bash
grep "pub fn detect_network_service" src-tauri/src/sys_config.rs
```

Run: in `/Users/acchuang/Project/dns-wizard`
Expected: Output shows `pub fn detect_network_service`. If it shows `fn detect_network_service` (no `pub`), add `pub ` before `fn`.

- [ ] **Step 3: Make `ConfigResult` importable from `sys_config`**

Verify `src-tauri/src/lib.rs` imports `ConfigResult` from `sys_config`. In the existing plan for `lib.rs` (chunk 2), the import line already includes:
```rust
use sys_config::{detect_network_service, set_dns_macos, restore_dns_macos, ConfigResult};
```
If `detect_network_service` is not yet in this import, add it.

- [ ] **Step 4: Verify Rust compilation**

```bash
cargo build
```

Run: in `/Users/acchuang/Project/dns-wizard/src-tauri`
Expected: Successful compilation.

- [ ] **Step 5: Run Rust tests**

```bash
cargo test
```

Run: in `/Users/acchuang/Project/dns-wizard/src-tauri`
Expected: All tests pass.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat: add admin privilege escalation commands via osascript"
```

### Task 4.2: Fix CSS keyframe sequencing

**Files:**
- Modify: `src/styles/index.css`

- [ ] **Step 1: Move `@keyframes spin` to be added during Task 3.5 instead of Task 3.6**

If Chunk 3 has already been executed and `@keyframes spin` was only added in Task 3.6 Step 3, add it earlier. Check if `@keyframes spin` exists in `src/styles/index.css`. If missing, append:

```css
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
```

- [ ] **Step 2: Commit (if changes needed)**

```bash
git add -A && git commit -m "fix: ensure spinner keyframes exist before Step2 component uses them"
```

### Task 4.3: Conditional admin buttons in Step3

**Files:**
- Modify: `src/components/Step3_Results.tsx`

- [ ] **Step 1: Track which operation failed**

In `Step3_Results`, the `error` prop now carries context about whether it was an `apply` or `restore` failure. The `App.tsx` already tracks which operation failed via the callback path. For simplicity, check the error message content:

Only show "Authorize Apply" if the error came from `apply_dns`, and only show "Authorize Restore" if the error came from `restore_dns`. The Rust `apply_dns` returns `"Admin privileges required to update DNS settings."` and `restore_dns` returns `"Admin privileges required to restore DNS settings."`.

Update the admin error block in `Step3_Results` (approximately lines 757-766 in the plan):

Replace:
```tsx
      {error && error.includes(ADMIN_ERROR_MESSAGE) && (
        <div style={{ display: "flex", gap: 8 }}>
          <button style={authBtn} onClick={onAuthorizeApply}>
            Authorize Apply
          </button>
          <button style={authBtn} onClick={onAuthorizeRestore}>
            Authorize Restore
          </button>
        </div>
      )}
```

With:
```tsx
      {error && error.includes("Admin privileges") && (
        <div style={{ display: "flex", gap: 8 }}>
          {!applied && error.includes("update") && (
            <button style={authBtn} onClick={onAuthorizeApply}>
              Authorize Apply
            </button>
          )}
          {applied && error.includes("restore") && (
            <button style={authBtn} onClick={onAuthorizeRestore}>
              Authorize Restore
            </button>
          )}
        </div>
      )}
```

- [ ] **Step 2: Verify TypeScript compilation**

```bash
npx tsc --noEmit
```

Run: in `/Users/acchuang/Project/dns-wizard`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "fix: show only relevant authorize button based on which operation failed"
```

### Task 4.4: Full build and DMG verification

**Files:**
- None (build verification only)

- [ ] **Step 1: Build the frontend**

```bash
npm run build
```

Run: in `/Users/acchuang/Project/dns-wizard`
Expected: `dist/` directory created with built assets.

- [ ] **Step 2: Build the Tauri app**

```bash
npm run tauri build
```

Run: in `/Users/acchuang/Project/dns-wizard`
Expected: Successful build. DMG file produced at `src-tauri/target/release/bundle/dmg/`.

- [ ] **Step 3: Verify DMG exists and has expected contents**

```bash
ls -la src-tauri/target/release/bundle/dmg/
```

Run: in `/Users/acchuang/Project/dns-wizard`
Expected: `DNS Wizard_1.0.0_aarch64.dmg` file present.

- [ ] **Step 4: Verify the .app bundle is code-signed (ad-hoc)**

```bash
codesign -dv "src-tauri/target/release/bundle/macos/DNS Wizard.app" && echo "Valid signature" || echo "Ad-hoc signing (expected for local builds)"
```

Run: in `/Users/acchuang/Project/dns-wizard`
Expected: Tauri 2 bundles use ad-hoc signing by default. Verification confirms the .app structure is valid.

- [ ] **Step 5: Commit any final build artifacts**

```bash
git add -A && git commit -m "build: verify DMG output and final integration"
```

---
