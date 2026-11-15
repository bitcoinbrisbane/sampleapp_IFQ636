import { gql } from '@apollo/client';

// Shared fields for a debate summary (list view).
export const DEBATE_SUMMARY = gql`
  fragment DebateSummary on Debate {
    id
    motion
    status
    creator { id name }
    proposition { id name }
    opposition { id name }
    currentRound
    currentSide
  }
`;

export const GET_DEBATES = gql`
  query GetDebates($status: String) {
    debates(status: $status) {
      ...DebateSummary
    }
  }
  ${DEBATE_SUMMARY}
`;

export const GET_DEBATE = gql`
  query GetDebate($id: ID!) {
    debate(id: $id) {
      ...DebateSummary
      turnDeadline
      winner
      voteTally { proposition opposition }
      arguments {
        id
        round
        side
        text
        author { id name }
        createdAt
      }
    }
  }
  ${DEBATE_SUMMARY}
`;

export const CREATE_DEBATE = gql`
  mutation CreateDebate($motion: String!) {
    createDebate(motion: $motion) {
      ...DebateSummary
    }
  }
  ${DEBATE_SUMMARY}
`;

export const JOIN_DEBATE = gql`
  mutation JoinDebate($id: ID!) {
    joinDebate(id: $id) {
      ...DebateSummary
    }
  }
  ${DEBATE_SUMMARY}
`;

export const SUBMIT_ARGUMENT = gql`
  mutation SubmitArgument($id: ID!, $text: String!) {
    submitArgument(id: $id, text: $text) {
      ...DebateSummary
      arguments { id round side text author { id name } }
    }
  }
  ${DEBATE_SUMMARY}
`;

export const DELETE_DEBATE = gql`
  mutation DeleteDebate($id: ID!) {
    deleteDebate(id: $id)
  }
`;
