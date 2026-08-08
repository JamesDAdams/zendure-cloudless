# Changelog

All notable changes to Zendure Cloudless Home Assistant Add-on will be documented in this file.

## 1.0.9
- Fixed Docker multi-architecture build failure (exit code 132 SIGILL) on ARM64 by sharing compiled native binaries from the builder stage.

## 1.0.8
- Added changelog for Home Assistant Add-on Store UI.
- Improved version discovery and update notification compatibility.

## 1.0.7
- Fixed energy totals rounding truncation issue where `solarEnergy` and `outputHomeEnergy` remained at 0 kWh.
- Enhanced MQTT payload handling to support both flat and nested telemetry property structures.

## 1.0.6
- Unified MQTT state topic slugs.
- Preserved state on partial device reports.
