from datetime import datetime, timedelta
import json
from logging import Logger
import logging
from math import floor
import os
from typing import Any, Dict, List, Literal, Optional, Tuple
import requests
from sqlalchemy.orm import aliased
from sqlmodel import or_, select
from models.pkm.sport_game import SportGame
from models.pkm.sport_team import SportTeam
from models.types import USER, Sport, SportBroker
from services import MEMORY_DIR, backup_memory, fetch_scoreboard_on_date, get_sport_team_by_full_name, normalize_espn_team_name, sqlite_session
from services.aws import send_email
from services.google_sheets import get_spreadsheets, prepend_rows
from services import to_dollar_float
from vellum.workflows.state.encoder import DefaultStateEncoder
from vellum.workflows import BaseWorkflow
from vellum.workflows.nodes import BaseNode
from vellum.core.pydantic_utilities import UniversalBaseModel

SPREADSHEET_ID = "1-wq0IIQd31xsMB1ZAxgflN0TQNuewjQHVVGEeVKUEbI"

class RecordYesterdaysGames(BaseNode):
    class Outputs(BaseNode.Outputs):
        initial_balance: float
        yesterday_recap: str
        active_broker: SportBroker

    def run(self) -> Outputs:
        yesterday = datetime.now() - timedelta(days=1)
        logger: Logger = getattr(self._context, "logger", logging.getLogger(__name__))
        fetch_scoreboard_on_date(yesterday, logger)

        sheets = get_spreadsheets()
        recent_bets = sheets.values().get(spreadsheetId=SPREADSHEET_ID, range="Bets!A2:I100").execute()["values"]
        yesterday_cell = yesterday.strftime("%m/%d/%y")
        yesterday_games = [
            (index, row)
            for index, row in enumerate(recent_bets)
            if row[0] == yesterday_cell
        ]

        previous_balance_data = sheets.values().get(spreadsheetId=SPREADSHEET_ID, range="Cash Flows!B2:C4").execute()["values"]
        previous_balance = {
            SportBroker(row[1]): to_dollar_float(row[0])
            for row in previous_balance_data
        }
        active_broker = SportBroker(sheets.values().get(spreadsheetId=SPREADSHEET_ID, range="Analytics!J2").execute()["values"][0][0])

        if not yesterday_games:
            logger.info("No bets submitted yesterday")
            initial_balance = sum(previous_balance.values())
            return self.Outputs(
                active_broker=active_broker,
                initial_balance=initial_balance,
                yesterday_recap=f"No bets submitted yesterday. Your balance is ${initial_balance}.",
            )

        with sqlite_session() as session:
            HomeTeam = aliased(SportTeam, name="home_team")
            AwayTeam = aliased(SportTeam, name="away_team")
            statement = select(  # type: ignore
                SportGame.away_team_score,
                SportGame.home_team_score,
                AwayTeam.location.label("away_team_location"),  # type: ignore
                AwayTeam.name.label("away_team_name"),  # type: ignore
                HomeTeam.location.label("home_team_location"),  # type: ignore
                HomeTeam.name.label("home_team_name"),  # type: ignore
                HomeTeam.sport,
            ).join(
                AwayTeam, 
                SportGame.away_team_id == AwayTeam.id,  # type: ignore
                isouter=True
            ).join(
                HomeTeam,
                SportGame.home_team_id == HomeTeam.id,  # type: ignore
                isouter=True
            ).where(
                SportGame.start_time >= yesterday - timedelta(days=1),  # type: ignore
            ).order_by(SportGame.start_time.desc())  # type: ignore
            games = session.exec(statement).all()

        winnings = []
        total_wager = 0.0
        range_min: Optional[int] = None
        range_max: Optional[int] = None
        sports_records: Dict[Sport, Tuple[int, int, int]] = {}
        yesterday_broker = SportBroker.HARDROCKBET
        for index, row in yesterday_games:
            if "COVERS" not in row[6]:
                continue

            # TODO: should be winnings by broker
            yesterday_broker = SportBroker(row[8])

            if range_min is None or index + 2 < range_min:
                range_min = index + 2
            if range_max is None or index + 2 > range_max:
                range_max = index + 2

            picks = row[6].split(" COVERS ")
            selected_winner = picks[0]
            selected_spread = float(row[5].split(" ")[1])
            sport = Sport(row[4])
            odds = int(row[2])
            wager = to_dollar_float(row[1])
            total_wager = round(total_wager + wager, 2)
            
            recent_game = next((game for game in games if game.sport == sport and f"{game.home_team_location} {game.home_team_name}" in picks and f"{game.away_team_location} {game.away_team_name}" in picks), None)
            if not recent_game:
                logger.exception(f"Failed to find recent game for {picks} in {sport}. Treating as a void...")
                winnings.append([wager])
                continue
            did_win = False
            did_tie = False
            home_team = f"{recent_game.home_team_location} {recent_game.home_team_name}"
            away_team = f"{recent_game.away_team_location} {recent_game.away_team_name}"

            if selected_winner == home_team:
                did_win = recent_game.home_team_score + selected_spread > recent_game.away_team_score
                did_tie = recent_game.home_team_score + selected_spread == recent_game.away_team_score
            elif selected_winner == away_team:
                did_win = recent_game.away_team_score + selected_spread > recent_game.home_team_score
                did_tie = recent_game.away_team_score + selected_spread == recent_game.home_team_score
            else:
                raise ValueError(f"Selected winner {selected_winner} not found in game {away_team} @ {home_team}")

            sport_record = sports_records.get(sport, (0, 0, 0))
            if did_tie:
                winnings.append([wager])
                sports_records[sport] = (sport_record[0], sport_record[1], sport_record[2] + 1)
            elif did_win:
                delta = (wager * 100 / -odds) if odds < 0 else (wager * odds / 100)
                winning = round(wager + delta, 2)
                winnings.append([winning])
                sports_records[sport] = (sport_record[0] + 1, sport_record[1], sport_record[2])
            else:
                winnings.append([0])
                sports_records[sport] = (sport_record[0], sport_record[1]+ 1, sport_record[2])


        range_name = f"Bets!D{range_min}:D{range_max}"
        total_winnings = sum([w[0] for w in winnings])
        profit = round(total_winnings - total_wager, 2)
        total_record = (
            sum(record[0] for record in sports_records.values()),
            sum(record[1] for record in sports_records.values()),
            sum(record[2] for record in sports_records.values()),
        )
        format_record = lambda x: f"{x[0]} - {x[1]} - {x[2]}" if x[2] > 0 else f"{x[0]} - {x[1]}"
        sport_records = "\n".join([f"{sport.value}: {format_record(record)}" for sport, record in sports_records.items()])

        sheets.values().update(
            spreadsheetId=SPREADSHEET_ID,
            range=range_name,
            valueInputOption='USER_ENTERED',
            body={
                "values": winnings
            }
        ).execute()        

        previous_balance[yesterday_broker] = previous_balance[yesterday_broker] - total_wager + total_winnings
        sheets.values().update(
            spreadsheetId=SPREADSHEET_ID,
            range="Cash Flows!B2:B4",
            valueInputOption='USER_ENTERED',
            body={
                "values": [
                    [previous_balance[SportBroker.HARDROCKBET]],
                    [previous_balance[SportBroker.FANDUEL]],
                    [previous_balance[SportBroker.PARLAYPARTAY]]
                ]
            }
        ).execute()  

        total_balance = sum(previous_balance.values())
        yesterday_recap = f"""\
Won ${total_winnings} on ${total_wager} wagered for a profit of ${profit}. Your new balance is:
- ${previous_balance[SportBroker.HARDROCKBET]} on Hard Rock Bet
- ${previous_balance[SportBroker.FANDUEL]} on FanDuel
- ${previous_balance[SportBroker.PARLAYPARTAY]} on Parlay Partay
- ${total_balance} Total

TOTAL RECORD: {format_record(total_record)}
{sport_records}
"""

        initial_balance = previous_balance[active_broker]
        return self.Outputs(initial_balance=initial_balance, yesterday_recap=yesterday_recap, active_broker=active_broker)


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
    bookmaker: SportBroker
    is_neutral: bool


ODDS_API_BROKER_MAP = {
    SportBroker.FANDUEL: "fanduel",
    SportBroker.HARDROCKBET: "hardrockbet",
    SportBroker.PARLAYPARTAY: "hardrockbet",
}


class GatherTodaysGames(BaseNode):
    sports = [
        "baseball_mlb",
        "basketball_nba",
        "americanfootball_nfl",
        "basketball_ncaab",
    ]
    active_broker = RecordYesterdaysGames.Outputs.active_broker

    class Outputs(BaseNode.Outputs):
        odds: List[TodaysGame]

    def run(self) -> Outputs:
        ncaab_top_25_url = "http://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/rankings"
        ncaab_top_25_response = requests.get(ncaab_top_25_url)
        ncaab_top_25_response.raise_for_status()
        ncaab_top_25_data = ncaab_top_25_response.json()
        poll = next((poll for poll in ncaab_top_25_data["rankings"] if poll["shortName"] == "AP Poll"), None)
        if not poll:
            raise ValueError("AP Poll not found")
        
        ncaab_top_25 = {normalize_espn_team_name(rank) for rank in poll['ranks']}

        ncaab_today_url = "https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/scoreboard"
        ncaab_today_response = requests.get(ncaab_today_url)
        ncaab_today_response.raise_for_status()
        ncaab_today_data = ncaab_today_response.json()

        is_neutral: Dict[str, bool] = {}
        ncaab_game_map = {}
        for event in ncaab_today_data["events"]:
            competition = event['competitions'][0]
            is_tournament = competition.get("type", {}).get("abbreviation") == "TRNMNT"
            home_team = next(normalize_espn_team_name(c) for c in competition['competitors'] if c['homeAway'] == 'home')
            away_team = next(normalize_espn_team_name(c) for c in competition['competitors'] if c['homeAway'] == 'away')
            game_key = f"{away_team} @ {home_team}"
            ncaab_game_map[game_key] = {"is_tournament": is_tournament, "is_top_25": home_team in ncaab_top_25 or away_team in ncaab_top_25}
            is_neutral[game_key] = competition.get('neutralSite') == True

        api_key = os.getenv("ODDS_API_KEY")
        odds = []
        now = datetime.now()

        today_start = now.strftime("%Y-%m-%dT%H:%M:%SZ")
        today_end = (now + timedelta(days=1)).strftime("%Y-%m-%dT%H:%M:%SZ")
        logger: Logger = getattr(self._context, "logger", logging.getLogger(__name__))

        for sport in self.sports:
            url = f"https://api.the-odds-api.com/v4/sports/{sport}/odds"
            params = {
                "apiKey": api_key,
                "markets": "spreads",
                "oddsFormat": "american",
                "bookmakers": [ODDS_API_BROKER_MAP[self.active_broker]],
                "commenceTimeFrom": today_start,
                "commenceTimeTo": today_end,
            }
            response = requests.get(url, params=params)
            response.raise_for_status()
            entries = [OddsAPIResponseEntry.model_validate(entry) for entry in response.json()]
            for entry in entries:
                if not entry.bookmakers:
                    logger.info(f"No bookmakers for {entry.home_team} vs. {entry.away_team}. Skipping...")
                    continue

                try:
                    odd = self._parse_odds(entry, is_neutral)
                except Exception:
                    logger.exception(f"Failed to parse odds for {entry.home_team} vs {entry.away_team}")
                    continue

                game_key = f"{odd.away_team.full_name} @ {odd.home_team.full_name}"
                if odd.sport != Sport.NCAAB or game_key not in ncaab_game_map or ncaab_game_map[game_key]["is_tournament"] or ncaab_game_map[game_key]["is_top_25"]:
                    odds.append(odd)

        return self.Outputs(odds=odds)

    def _parse_odds(self, entry: OddsAPIResponseEntry, is_neutral: Dict[str, bool]) -> TodaysGame:
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
            bookmaker=self.active_broker,
            is_neutral=is_neutral.get(f"{away_team.full_name} @ {home_team.full_name}", False)
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

            home_multiplier = 1.0 if game.is_neutral else 1.1
            away_multiplier = 1.0 if game.is_neutral else 0.9
            home_recency_score = sum(game.score_diff * (0.9 if game.was_home else 1.1) for game in home_team_last_5_games) * home_multiplier
            away_recency_score = sum(game.score_diff * (0.9 if not game.was_home else 1.1) for game in away_team_last_5_games) * away_multiplier

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
            ).order_by(SportGame.start_time.desc()).limit(5)  # type: ignore
            sport_games = session.exec(statement).all()
        
        return [
            TeamRecentGame(
                score_diff=game.home_team_score - game.away_team_score if game.home_team_id == team.id else game.away_team_score - game.home_team_score,
                was_home=game.home_team_id == team.id,
            )
            for game in sport_games
        ]


class SubmitBets(BaseNode):
    outcomes = PredictOutcomes.Outputs.outcomes
    initial_balance = RecordYesterdaysGames.Outputs.initial_balance

    class Outputs(BaseNode.Outputs):
        wagers: Dict[str, Any]

    def run(self) -> Outputs:
        rows: list[list[str | float | None]] = []
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

            spread_amount = outcome.game.spread if outcome.outcome == "home" else -outcome.game.spread
            pick = f"{outcome.game.home_team.full_name if outcome.outcome == "home" else outcome.game.away_team.full_name} COVERS {outcome.game.away_team.full_name if outcome.outcome == "home" else outcome.game.home_team.full_name}"
            spread = f"{'+' if spread_amount > 0 else ''}{spread_amount}"
            odds = outcome.game.home_price if outcome.outcome == "home" else outcome.game.away_price
            picks.append((pick, outcome.confidence, wager, spread, odds))
            rows.append(
                [
                    date, # DATE
                    wager, # WAGER
                    odds, # ODDS
                    None, # WINNINGS
                    outcome.game.sport, # SPORT
                    f"Spread {spread}", # TYPE
                    pick, # PICK
                    date, # Event Date
                    outcome.game.bookmaker.value, # BROKER
                    None, # External ID
                ]
            )

        rows.reverse()
        prepend_rows(
            spreadsheet_id=SPREADSHEET_ID,
            rows=rows,
            sheet_name="Bets",
        )

        report_md_file = MEMORY_DIR / "reports" / "bets" / f"{date.replace('/', '-')}.md"
        
        with open(report_md_file, "w") as f:
            json.dump(self.outcomes, f, indent=2, cls=DefaultStateEncoder)

        return self.Outputs(
            wagers={
                "rows": rows,
                "balance": balance,
                "ran_out_of_money": ran_out_of_money,
                "picks": picks,
                "report_md_file": report_md_file,
                "date": date,
            }
        )
    

class SendSummary(BaseNode):
    recap = RecordYesterdaysGames.Outputs.yesterday_recap
    wagers = SubmitBets.Outputs.wagers

    class Outputs(BaseNode.Outputs):
        summary: str

    def run(self) -> Outputs:
        num_games = len(self.wagers['rows'])  # type: ignore
        balance = self.wagers['balance']  # type: ignore
        ran_out = self.wagers['ran_out_of_money']  # type: ignore
        picks_summary = "\n".join([f"- Bet ${wager:.2f} ({odds}) to {spread} {pick}. Confidence {confidence:.4f}" for pick, confidence, wager, spread, odds in self.wagers['picks']])  # type: ignore
        report_file = self.wagers['report_md_file']  # type: ignore
        
        summary = f"""\
Yesterday's Recap:

{self.recap}
---

Bets submitted for {num_games} games. Remaining balance: ${balance}{" (ran out of money)" if ran_out else ""}
---
{picks_summary}
---
Report: {report_file}
"""

        try:
            to_email = USER.email
            send_email(
                to=to_email,
                body=summary,
                subject="Submitted Bets for " + self.wagers['date'],  # type: ignore
            )
            return self.Outputs(summary=f"Sent bets to {to_email}.")
        except Exception:
            logger: Logger = getattr(self._context, "logger", logging.getLogger(__name__))
            logger.exception("Failed to send email")

        return self.Outputs(summary=summary)
    
class BackupMemory(BaseNode):
    def run(self) -> BaseNode.Outputs:
        logger: Logger = getattr(self._context, "logger", logging.getLogger(__name__))
        backup_memory(logger)
        return self.Outputs()


class MakeSportsBetsWorkflow(BaseWorkflow):
    graph = RecordYesterdaysGames >> GatherTodaysGames >> PredictOutcomes >> SubmitBets >> SendSummary >> BackupMemory

    class Outputs(BaseWorkflow.Outputs):
        summary = SendSummary.Outputs.summary
