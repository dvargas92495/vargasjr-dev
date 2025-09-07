from vellum.workflows import BaseWorkflow
from .nodes import (
    BuildPersonalFinancialContext,
    GetPlaidTransactions,
    NormalizeFamilyTransactions,
    UpdateFinances,
    GetSummaryData,
    SummarizeData,
    SendFinancesReport,
)














class WeeklyAccountingWorkflow(BaseWorkflow):
    graph = {
        BuildPersonalFinancialContext
        >> GetPlaidTransactions
        >> NormalizeFamilyTransactions
        >> UpdateFinances
        >> GetSummaryData
        >> SummarizeData
        >> SendFinancesReport,
    }

    class Outputs(BaseWorkflow.Outputs):
        summary = SendFinancesReport.Outputs.summary
