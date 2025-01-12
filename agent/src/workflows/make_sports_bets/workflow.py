from datetime import datetime, timedelta
import json
from math import floor
import os
from typing import List, Literal
import requests
from sqlmodel import or_, select
from src.models.pkm.sport_game import SportGame
from src.models.pkm.sport_team import SportTeam
from src.models.types import Sport
from src.services import get_sport_team_by_full_name, normalize_team_name, sqlite_session
from src.services.google_sheets import get_spreadsheets, prepend_rows
from vellum.workflows.state.encoder import DefaultStateEncoder
from vellum.workflows import BaseWorkflow
from vellum.workflows.inputs import BaseInputs
from vellum.workflows.nodes import BaseNode
from vellum.core.pydantic_utilities import UniversalBaseModel


OddsAPISport = Literal[
    "americanfootball_nfl",
    "baseball_mlb",
    "basketball_nba",
    "basketball_ncaab",
]

SPORT_MAP: dict[OddsAPISport, Sport] = {
    "baseball_mlb": Sport.MLB,
    "basketball_nba": Sport.NBA,
    "americanfootball_nfl": Sport.NFL,
    "basketball_ncaab": Sport.NCAAB,
}


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
    sport_key: OddsAPISport
    sport_title: str
    commence_time: str
    home_team: str
    away_team: str
    bookmakers: List[OddsAPIResponseBookmaker]


class TodaysGame(UniversalBaseModel):
    sport: Sport
    home_team: SportTeam
    away_team: SportTeam
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
        
        ncaab_top_25 = [normalize_team_name(f"{rank['team']['location']} {rank['team']['name']}") for rank in poll['ranks']]

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
                try:
                    odd = self._parse_odds(entry)
                except Exception:
                    continue

                if odd.sport != Sport.NCAAB:
                    odds.append(odd)
                    continue

                if not any(team == odd.home_team.full_name or team == odd.away_team.full_name for team in ncaab_top_25):
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

        sport = SPORT_MAP[entry.sport_key]
        try:
            home_team = get_sport_team_by_full_name(sport, entry.home_team)
        except Exception as e:
            raise ValueError(f"Failed to find team: {entry.home_team}") from e

        try:
            away_team = get_sport_team_by_full_name(sport, entry.away_team)
        except Exception as e:
            raise ValueError(f"Failed to find team: {entry.away_team}") from e

        return TodaysGame(
            sport=sport,
            home_team=home_team,
            away_team=away_team,
            home_price=home_outcome.price,
            away_price=away_outcome.price,
            spread=home_outcome.point,
            bookmaker=bookmaker.key,
        )

class TeamRecentGame(UniversalBaseModel):
    score_diff: int
    was_home: bool

class PredictedOutcomeReasoning(UniversalBaseModel):
    home_team_last_5_games: List[TeamRecentGame]
    away_team_last_5_games: List[TeamRecentGame]
    home_team_recency_score: float
    away_team_recency_score: float
    calculated_spread: float

class PredictedOutcome(UniversalBaseModel):
    game: TodaysGame
    outcome: Literal["home", "away"]
    confidence: float
    reasoning: PredictedOutcomeReasoning

class PredictOutcomes(BaseNode):
    games = GatherTodaysGames.Outputs.odds

    class Outputs(BaseNode.Outputs):
        outcomes: List[PredictedOutcome]

    def run(self):
        outcomes = []
        for game in self.games:
            home_team_last_5_games = self._get_team_last_5_games(game.home_team)
            away_team_last_5_games = self._get_team_last_5_games(game.away_team)

            home_recency_score = sum(game.score_diff * (0.9 if game.was_home else 1.1) for game in home_team_last_5_games) * 1.1
            away_recency_score = sum(game.score_diff * (0.9 if not game.was_home else 1.1) for game in away_team_last_5_games) * 0.9

            calculated_spread = (away_recency_score - home_recency_score) / 5
            outcome = "home" if calculated_spread < game.spread else "away"
            confidence = abs(calculated_spread - game.spread)

            outcomes.append(
                PredictedOutcome(
                    game=game,
                    outcome=outcome,
                    confidence=confidence,
                    reasoning=PredictedOutcomeReasoning(
                        home_team_last_5_games=home_team_last_5_games,
                        away_team_last_5_games=away_team_last_5_games,
                        home_team_recency_score=home_recency_score,
                        away_team_recency_score=away_recency_score,
                        calculated_spread=calculated_spread,
                    ),
                )
            )

        return self.Outputs(outcomes=sorted(outcomes, key=lambda x: x.confidence, reverse=True))
    
    def _get_team_last_5_games(self, team: SportTeam) -> List[TeamRecentGame]:
        with sqlite_session() as session:
            statement = select(SportGame).where(
                or_(SportGame.home_team_id == team.id, SportGame.away_team_id == team.id),
            ).order_by(SportGame.start_time.desc()).limit(5)
            sport_games = session.exec(statement).all()
        
        return [
            TeamRecentGame(
                score_diff=game.home_team_score - game.away_team_score if game.home_team_id == team.id else game.away_team_score - game.home_team_score,
                was_home=game.home_team_id == team.id,
            )
            for game in sport_games
        ]

BROKER_MAP = {
    "fanduel": "Fanduel",
    "hardrockbet": "Hard Rock Bet",
}

class SubmitBets(BaseNode):
    outcomes = PredictOutcomes.Outputs.outcomes
    initial_balance = Inputs.initial_balance

    class Outputs(BaseNode.Outputs):
        summary: str

    def run(self):
        rows = []
        date = datetime.now().strftime("%Y/%m/%d")
        balance = self.initial_balance
        picks = []
        ran_out_of_money = False
        for outcome in self.outcomes:
            wager = max(1, floor(balance * 5) / 100)
            balance = round(balance - wager, 2)
            if balance < 1:
                ran_out_of_money = True
                break

            spread = outcome.game.spread if outcome.outcome == "home" else -outcome.game.spread
            pick = f"{outcome.game.home_team.full_name if outcome.outcome == "home" else outcome.game.away_team.full_name} COVERS {outcome.game.away_team.full_name if outcome.outcome == "home" else outcome.game.home_team.full_name}"
            picks.append((pick, outcome.confidence, wager))
            rows.append(
                [
                    date, # DATE
                    wager, # WAGER
                    outcome.game.home_price if outcome.outcome == "home" else outcome.game.away_price, # ODDS
                    None, # WINNINGS
                    outcome.game.sport, # SPORT
                    f"Spread {"+" if spread > 0 else ""}{spread}", # TYPE
                    pick, # PICK
                    date, # Event Date
                    BROKER_MAP[outcome.game.bookmaker], # BROKER
                    None, # External ID
                ]
            )

        SPREADSHEET_ID = "1-wq0IIQd31xsMB1ZAxgflN0TQNuewjQHVVGEeVKUEbI"

        rows.reverse()
        prepend_rows(
            spreadsheet_id=SPREADSHEET_ID,
            rows=rows,
            sheet_name="Bets",
        )

        report_md_file = f"data/reports/bets/{date.replace('/', '-')}.md"
        summary = f"""\
Bets submitted for {len(rows)} games. Remaining balance: ${balance}{" (ran out of money)" if ran_out_of_money else ""}
---
{"\n".join([f"Picked {pick} with ${wager:.2f} on confidence {confidence:.4f}" for pick, confidence, wager in picks])}
---
Report: {report_md_file}
"""
        
        with open(report_md_file, "w") as f:
            json.dump(self.outcomes, f, indent=2, cls=DefaultStateEncoder)

        return self.Outputs(summary=summary)


class MakeSportsBetsWorkflow(BaseWorkflow):
    graph = GatherTodaysGames >> PredictOutcomes >> SubmitBets

    class Outputs(BaseWorkflow.Outputs):
        summary = SubmitBets.Outputs.summary
