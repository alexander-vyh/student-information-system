"""
SIS Course Scheduler - OR-Tools CP-SAT based optimization service.

This service provides constraint-based course scheduling optimization
using Google's OR-Tools CP-SAT solver. It handles:

- Time slot assignment for course sections
- Room allocation with capacity and feature matching
- Instructor assignment with workload balancing
- Conflict detection and resolution
- Soft constraint optimization (preferences)
"""

__version__ = "0.1.0"
