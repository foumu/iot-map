# Contributing

Thanks for considering a contribution. This project is intentionally small and static so frontend developers can experiment with IoT map interaction patterns quickly.

## Local Setup

```bash
python3 -m http.server 4173 --bind 127.0.0.1
```

Open:

[http://127.0.0.1:4173/](http://127.0.0.1:4173/)

## Useful Contribution Areas

- Improve accessibility for keyboard and screen reader use.
- Add more realistic floor plan examples.
- Add device filtering, search, or alert workflows.
- Improve responsive behavior for tablets and large displays.
- Split the current static implementation into reusable modules.
- Add tests for data aggregation and view state transitions.

## Data Changes

Mock business data lives in:

```text
data/iot-map.json
```

When adding places or devices, keep coordinates normalized to the visual canvas and prefer realistic device names and status mixes.

## Pull Request Checklist

- The demo runs locally without a build step.
- JSON data remains valid.
- New UI still works with pan and wheel zoom.
- Large desktop and narrow viewport layouts remain usable.
- Documentation is updated when behavior changes.
