import csv
from datetime import datetime, timedelta
import io
import json
from math import floor
import os
import random
from typing import List, Literal
import requests
from google.oauth2.service_account import Credentials
from googleapiclient.discovery import build
from vellum.workflows import BaseWorkflow
from vellum.workflows.inputs import BaseInputs
from vellum.workflows.nodes import BaseNode
from vellum.core.pydantic_utilities import UniversalBaseModel


SPORTS = Literal[
    "americanfootball_nfl",
    "baseball_mlb",
    "basketball_nba",
    "basketball_ncaab",
]


class OddsAPIResponseOutcome(UniversalBaseModel):
    name: str
    price: int
    point: float


class OddsAPIResponseMarket(UniversalBaseModel):
    key: str
    last_update: str
    outcomes: List[OddsAPIResponseOutcome]


class OddsAPIResponseBookmaker(UniversalBaseModel):
    key: str
    title: str
    last_update: str
    markets: List[OddsAPIResponseMarket]


class OddsAPIResponseEntry(UniversalBaseModel):
    id: str
    sport_key: SPORTS
    sport_title: str
    commence_time: str
    home_team: str
    away_team: str
    bookmakers: List[OddsAPIResponseBookmaker]


class TodaysGame(UniversalBaseModel):
    sport: SPORTS
    home_team: str
    away_team: str
    home_price: int
    away_price: int
    spread: float
    bookmaker: str

class Inputs(BaseInputs):
    initial_balance: float


class GatherTodaysGames(BaseNode):
    sports = [
        "baseball_mlb",
        "basketball_nba",
        "americanfootball_nfl",
        "basketball_ncaab",
    ]

    class Outputs(BaseNode.Outputs):
        odds: List[TodaysGame]

    def run(self):
        ncaab_top_25_url = "http://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/rankings"
        ncaab_top_25_response = requests.get(ncaab_top_25_url)
        ncaab_top_25_response.raise_for_status()
        ncaab_top_25_data = ncaab_top_25_response.json()
        poll = next((poll for poll in ncaab_top_25_data["rankings"] if poll["shortName"] == "AP Poll"), None)
        if not poll:
            raise ValueError("AP Poll not found")
        
        ncaab_top_25 = [f"{rank['team']['location']} {rank['team']['name']}" for rank in poll['ranks']]

        api_key = os.getenv("ODDS_API_KEY")
        odds = []
        now = datetime.now()

        today_start = now.strftime("%Y-%m-%dT%H:%M:%SZ")
        today_end = (now + timedelta(days=1)).strftime("%Y-%m-%dT%H:%M:%SZ")

        for sport in self.sports:
            url = f"https://api.the-odds-api.com/v4/sports/{sport}/odds"
            params = {
                "apiKey": api_key,
                "regions": ["us", "us2"],
                "markets": "spreads",
                "oddsFormat": "american",
                "bookmakers": ["fanduel", "hardrockbet"],
                "commenceTimeFrom": today_start,
                "commenceTimeTo": today_end,
            }
            response = requests.get(url, params=params)
            response.raise_for_status()
            entries = [OddsAPIResponseEntry.model_validate(entry) for entry in response.json()]
            for entry in entries:
                odd = self._parse_odds(entry)
                if odd.sport != "basketball_ncaab":
                    odds.append(odd)
                    continue

                if not any(self._team_matches(team, odd.home_team) or self._team_matches(team, odd.away_team) for team in ncaab_top_25):
                    continue
                
                odds.append(odd)

        return self.Outputs(odds=odds)

    def _parse_odds(self, entry: OddsAPIResponseEntry) -> TodaysGame:
        if not entry.bookmakers:
            raise ValueError(f"No bookmakers found for {entry.home_team} vs {entry.away_team}")

        bookmaker = entry.bookmakers[0]
        market = next((market for market in bookmaker.markets if market.key == "spreads"), None)
        if not market:
            raise ValueError(f"No spreads market found for {entry.home_team} vs {entry.away_team}")

        home_outcome = next((outcome for outcome in market.outcomes if outcome.name == entry.home_team), None)
        away_outcome = next((outcome for outcome in market.outcomes if outcome.name == entry.away_team), None)
        if not home_outcome or not away_outcome:
            raise ValueError(f"No outcomes found for {entry.home_team} vs {entry.away_team}")

        return TodaysGame(
            sport=entry.sport_key,
            home_team=entry.home_team,
            away_team=entry.away_team,
            home_price=home_outcome.price,
            away_price=away_outcome.price,
            spread=home_outcome.point,
            bookmaker=bookmaker.key,
        )
    
    def _team_matches(self, team: str, other: str) -> bool:
        return team == other or team.replace("State", "St") == other or team == other.replace("State", "St")

class PredictedOutcome(UniversalBaseModel):
    game: TodaysGame
    outcome: Literal["home", "away"]


class PredictOutcomes(BaseNode):
    games = GatherTodaysGames.Outputs.odds

    class Outputs(BaseNode.Outputs):
        outcomes: List[PredictedOutcome]

    def run(self):
        outcomes = []
        for game in self.games:
            threshold = random.random()
            if threshold < 0.6:
                outcomes.append(
                    PredictedOutcome(
                        game=game,
                        outcome="home",
                    )
                )
            else:
                outcomes.append(
                    PredictedOutcome(
                        game=game,
                        outcome="away",
                    )
                )

        return self.Outputs(outcomes=outcomes)

BROKER_MAP = {
    "fanduel": "Fanduel",
    "hardrockbet": "Hard Rock Bet",
}

SPORT_MAP = {
    "baseball_mlb": "MLB",
    "basketball_nba": "NBA",
    "americanfootball_nfl": "NFL",
    "basketball_ncaab": "NCAAB",
}

class SubmitBets(BaseNode):
    outcomes = PredictOutcomes.Outputs.outcomes
    initial_balance = Inputs.initial_balance

    class Outputs(BaseNode.Outputs):
        summary: str

    def run(self):
        creds_json = os.getenv("GOOGLE_CREDENTIALS")
        if not creds_json:
            raise ValueError("GOOGLE_CREDENTIALS environment variable not set")

        rows = []
        date = datetime.now().strftime("%Y/%m/%d")
        balance = self.initial_balance
        for outcome in self.outcomes:
            wager = max(1, floor(balance * 5) / 100)
            balance = round(balance - wager, 2)
            if balance < 1:
                raise Exception("Ran out of money")

            spread = outcome.game.spread if outcome.outcome == "home" else -outcome.game.spread
            rows.append(
                [
                    date, # DATE
                    wager, # WAGER
                    outcome.game.home_price if outcome.outcome == "home" else outcome.game.away_price, # ODDS
                    None, # WINNINGS
                    SPORT_MAP[outcome.game.sport], # SPORT
                    f"Spread {"+" if spread > 0 else ""}{spread}", # TYPE
                    f"{outcome.game.home_team if outcome.outcome == "home" else outcome.game.away_team} COVERS {outcome.game.away_team if outcome.outcome == "home" else outcome.game.home_team}", # PICK
                    date, # Event Date
                    BROKER_MAP[outcome.game.bookmaker], # BROKER
                    None, # External ID
                ]
            )

        SCOPES = ["https://www.googleapis.com/auth/spreadsheets"]
        SPREADSHEET_ID = "1-wq0IIQd31xsMB1ZAxgflN0TQNuewjQHVVGEeVKUEbI"
        google_credentials = Credentials.from_service_account_info(json.loads(creds_json), scopes=SCOPES,)
        service = build("sheets", "v4", credentials=google_credentials)
        sheet = service.spreadsheets()

        rows.reverse()
        sheet.batchUpdate(
            spreadsheetId=SPREADSHEET_ID,
            body={
                "requests": [{
                    "insertRange": {
                        "range": {
                            "sheetId": 0,
                            "startRowIndex": 1,
                            "endRowIndex": 1+len(rows),
                        },
                        "shiftDimension": "ROWS",
                    }
                }]
            }
        ).execute()

        sheet.values().update(
            spreadsheetId=SPREADSHEET_ID,
            range="Bets!A2",
            valueInputOption="USER_ENTERED",
            body={"values": rows},
        ).execute()

        summary = f"Bets submitted for {len(rows)} games. Remaining balance: ${balance}"
        return self.Outputs(summary=summary)


class MakeSportsBetsWorkflow(BaseWorkflow):
    graph = GatherTodaysGames >> PredictOutcomes >> SubmitBets

    class Outputs(BaseWorkflow.Outputs):
        summary = SubmitBets.Outputs.summary