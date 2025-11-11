# Fix File Watcher Limit Error

## Problem
The error `ENOSPC: System limit for number of file watchers reached` occurs because Linux has a limit on how many files can be watched simultaneously, and React Native/Expo projects watch many files.

## Solution

### Temporary Fix (until reboot)

Run this command to increase the limit temporarily:

```bash
sudo sysctl fs.inotify.max_user_watches=524288
```

### Permanent Fix

To make the change permanent, run:

```bash
echo fs.inotify.max_user_watches=524288 | sudo tee -a /etc/sysctl.conf
sudo sysctl -p
```

The `-p` flag applies the changes from `/etc/sysctl.conf` immediately.

### Verify

Check the new limit:

```bash
cat /proc/sys/fs/inotify/max_user_watches
```

It should show `524288` instead of `65536`.

## After Fixing

Once you've increased the limit, restart your Expo development server:

```bash
npm start
# or
npx expo start
```

