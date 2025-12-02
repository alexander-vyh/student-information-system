"""Tests for the FastAPI endpoints."""

from datetime import date, time
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

from scheduler.api.app import app
from scheduler.models import (
    Course,
    DatePattern,
    Instructor,
    MeetingPattern,
    MeetingTime,
    Room,
    Section,
    SolverInput,
)


@pytest.fixture
def client():
    """Create test client."""
    return TestClient(app)


@pytest.fixture
def valid_solver_input() -> dict:
    """Create valid solver input as dict for API testing."""
    schedule_version_id = str(uuid4())
    term_id = str(uuid4())
    institution_id = str(uuid4())
    building_id = str(uuid4())

    room1_id = str(uuid4())
    room2_id = str(uuid4())
    rooms = [
        {
            "id": room1_id,
            "code": "BLDG-101",
            "name": "Room 101",
            "capacity": 30,
            "building_id": building_id,
            "features": [],
        },
        {
            "id": room2_id,
            "code": "BLDG-102",
            "name": "Room 102",
            "capacity": 50,
            "building_id": building_id,
            "features": [],
        },
    ]

    inst1_id = str(uuid4())
    inst2_id = str(uuid4())
    instructors = [
        {
            "id": inst1_id,
            "name": "Dr. Smith",
            "min_load": 0,
            "max_load": 12,
            "time_preferences": [],
            "qualified_course_ids": [],
        },
        {
            "id": inst2_id,
            "name": "Dr. Jones",
            "min_load": 0,
            "max_load": 12,
            "time_preferences": [],
            "qualified_course_ids": [],
        },
    ]

    pattern1_id = str(uuid4())
    pattern2_id = str(uuid4())
    meeting_patterns = [
        {
            "id": pattern1_id,
            "name": "MWF 9:00-9:50",
            "code": "MWF9",
            "times": [
                {"day_of_week": 1, "start_time": "09:00:00", "end_time": "09:50:00"},
                {"day_of_week": 3, "start_time": "09:00:00", "end_time": "09:50:00"},
                {"day_of_week": 5, "start_time": "09:00:00", "end_time": "09:50:00"},
            ],
            "total_minutes_per_week": 150,
        },
        {
            "id": pattern2_id,
            "name": "TR 10:00-11:15",
            "code": "TR10",
            "times": [
                {"day_of_week": 2, "start_time": "10:00:00", "end_time": "11:15:00"},
                {"day_of_week": 4, "start_time": "10:00:00", "end_time": "11:15:00"},
            ],
            "total_minutes_per_week": 150,
        },
    ]

    date_pattern_id = str(uuid4())
    date_patterns = [
        {
            "id": date_pattern_id,
            "name": "Full Term",
            "first_date": "2024-08-26",
            "last_date": "2024-12-13",
        },
    ]

    course1_id = str(uuid4())
    course2_id = str(uuid4())
    courses = [
        {
            "id": course1_id,
            "code": "CS101",
            "name": "Intro to CS",
            "credit_hours": 3.0,
            "required_room_features": [],
        },
        {
            "id": course2_id,
            "code": "CS201",
            "name": "Data Structures",
            "credit_hours": 3.0,
            "required_room_features": [],
        },
    ]

    sections = [
        {
            "id": str(uuid4()),
            "course_id": course1_id,
            "section_number": "001",
            "expected_enrollment": 25,
            "credit_hours": 3.0,
            "assigned_instructor_ids": [inst1_id],
        },
        {
            "id": str(uuid4()),
            "course_id": course2_id,
            "section_number": "001",
            "expected_enrollment": 20,
            "credit_hours": 3.0,
            "assigned_instructor_ids": [inst2_id],
        },
    ]

    return {
        "schedule_version_id": schedule_version_id,
        "term_id": term_id,
        "institution_id": institution_id,
        "sections": sections,
        "rooms": rooms,
        "instructors": instructors,
        "courses": courses,
        "meeting_patterns": meeting_patterns,
        "date_patterns": date_patterns,
        "time_limit_seconds": 30,
    }


class TestHealthEndpoint:
    """Test health check endpoint."""

    def test_health_check(self, client):
        """Test health endpoint returns healthy status."""
        response = client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert "version" in data


class TestSolveEndpoint:
    """Test /solve endpoint."""

    def test_solve_synchronous(self, client, valid_solver_input):
        """Test synchronous solve returns valid response."""
        response = client.post(
            "/solve",
            json={"input": valid_solver_input, "async_mode": False},
        )
        assert response.status_code == 200
        data = response.json()

        assert "solver_run_id" in data
        assert data["status"] in ("optimal", "feasible")
        assert "output" in data
        assert len(data["output"]["assignments"]) == 2

    def test_solve_async_not_implemented(self, client, valid_solver_input):
        """Test async mode returns 501 not implemented."""
        response = client.post(
            "/solve",
            json={
                "input": valid_solver_input,
                "async_mode": True,
                "callback_url": "http://example.com/callback",
            },
        )
        assert response.status_code == 501

    def test_solve_async_requires_callback(self, client, valid_solver_input):
        """Test async mode requires callback_url."""
        response = client.post(
            "/solve",
            json={"input": valid_solver_input, "async_mode": True},
        )
        assert response.status_code == 400


class TestValidateEndpoint:
    """Test /validate endpoint."""

    def test_validate_valid_input(self, client, valid_solver_input):
        """Test validation passes for valid input."""
        response = client.post("/validate", json=valid_solver_input)
        assert response.status_code == 200
        data = response.json()

        assert data["valid"] is True
        assert len(data["issues"]) == 0
        assert data["section_count"] == 2
        assert data["room_count"] == 2
        assert data["pattern_count"] == 2

    def test_validate_no_valid_rooms(self, client, valid_solver_input):
        """Test validation catches sections with no valid rooms."""
        # Set enrollment higher than any room capacity
        valid_solver_input["sections"][0]["expected_enrollment"] = 1000

        response = client.post("/validate", json=valid_solver_input)
        assert response.status_code == 200
        data = response.json()

        assert data["valid"] is False
        assert len(data["issues"]) > 0
        assert any(issue["type"] == "no_valid_rooms" for issue in data["issues"])
