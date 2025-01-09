import json
import requests
from src.models.types import Sport, Team, TeamEspnData
from vellum.core.pydantic_utilities import UniversalBaseModel
from vellum.workflows.state.encoder import DefaultStateEncoder


class EspnSport(UniversalBaseModel):
    name: str
    league: str
    sport: Sport


ESPN_SPORTS = [
    EspnSport(name="baseball", league="mlb", sport="MLB"),
    EspnSport(name="basketball", league="nba", sport="NBA"),
    EspnSport(name="basketball", league="mens-college-basketball", sport="NCAAB"),
    EspnSport(name="football", league="nfl", sport="NFL"),
]


if __name__ == "__main__":
    all_teams = []
    for espn_sport in ESPN_SPORTS:
        url = f"http://site.api.espn.com/apis/site/v2/sports/{espn_sport.name}/{espn_sport.league}/teams"
        params = {
            "limit": 500,
        }
        response = requests.get(url, params=params)
        teams = response.json()["sports"][0]["leagues"][0]["teams"]
        for team in teams:
            all_teams.append(
                Team(
                    location=team["team"]["location"],
                    name=team["team"]["name"],
                    espn_data=TeamEspnData(
                        espn_id=team["team"]["id"],
                        espn_sport=espn_sport.name,
                        espn_league=espn_sport.league,
                    ),
                    sport=espn_sport.sport,
                )
            )

    with open("data/teams.json", "w") as f:
        json.dump(all_teams, f, cls=DefaultStateEncoder, indent=2)

    print(f"Wrote {len(all_teams)} teams to teams.json")
