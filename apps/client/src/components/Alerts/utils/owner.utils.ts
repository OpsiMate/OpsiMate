// Owner display/sort logic lives in @OpsiMate/shared so the server renders and sorts
// owners with identical semantics (UserInfo is structurally an AlertOwnerInfo).
export { getOwnerDisplayName, getOwnerSortKey } from '@OpsiMate/shared';
