from sqlmodel import select, func
from src.services import sqlite_session
from src.models.pkm.sport_game import SportGame
from src.models.pkm.sport_team import SportTeam
from sqlalchemy.orm import aliased


def main():
    with sqlite_session() as session:
        HomeTeam = aliased(SportTeam, name="home_team")
        AwayTeam = aliased(SportTeam, name="away_team")
        statement = (
            select(
                func.count(SportGame.id).label("count"),
                AwayTeam.name.label("away_name"),
                HomeTeam.name.label("home_name"),
                AwayTeam.id.label("away_team_id"),
                HomeTeam.id.label("home_team_id"),
                SportGame.start_time,
            )
            .join(AwayTeam, AwayTeam.id == SportGame.away_team_id)
            .join(HomeTeam, HomeTeam.id == SportGame.home_team_id)
            .group_by(SportGame.start_time, SportGame.home_team_id, SportGame.away_team_id)
            .order_by(func.count(SportGame.id).desc())
            .limit(40)
        )

        results = session.exec(statement).all()
        games_to_delete = []
        for result in results:
            if result.count <= 1:
                print(
                    f"Found only {result.count} game for {result.away_name}@{result.home_name} on {result.start_time}"
                )
                continue

            duplicate_games = select(SportGame).where(
                SportGame.start_time == result.start_time,
                SportGame.home_team_id == result.home_team_id,
                SportGame.away_team_id == result.away_team_id,
            )
            duplicates = session.exec(duplicate_games).all()
            print(
                f"Found {len(duplicates)} duplicate games for {result.away_name}@{result.home_name} on {result.start_time}"
            )
            games_to_delete.extend(duplicates[1:])

        for game in games_to_delete:
            session.delete(game)
        session.commit()
